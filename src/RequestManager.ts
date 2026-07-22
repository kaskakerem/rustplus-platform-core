/**
 * @fileoverview İstek-yanıt yöneticisi.
 * Sequence numarası tabanlı istek-yanıt eşleştirmesi yapar.
 * Protobuf encode/decode, rate limiting ve timeout yönetimini birleştirir.
 */

import { ProtoLoader } from './proto/ProtoLoader';
import { Connection } from './Connection';
import { RateLimiter } from './RateLimiter';
import { TOKEN_COSTS } from './types';
import type { AppResponse } from './types';

/**
 * Bekleyen bir isteği temsil eder.
 */
interface PendingRequest {
  resolve: (value: AppResponse) => void;
  reject: (reason: unknown) => void;
  timer: NodeJS.Timeout;
}

/**
 * Sequence numarası tabanlı istek-yanıt yöneticisi.
 * 
 * Her istek benzersiz bir seq numarası alır.
 * Sunucudan gelen yanıt aynı seq ile eşleştirilerek
 * ilgili Promise resolve/reject edilir.
 */
export class RequestManager {
  private seq: number = 0;
  private pendingRequests: Map<number, PendingRequest> = new Map();
  private protoLoader: ProtoLoader;
  private connection: Connection;
  private rateLimiter: RateLimiter;
  private playerId: string;
  private playerToken: number;
  private defaultTimeout: number;

  /**
   * @param protoLoader Protobuf yükleyici
   * @param connection WebSocket bağlantısı
   * @param rateLimiter Token bucket rate limiter
   * @param playerId Oyuncu Steam ID
   * @param playerToken Oyuncu tokenı
   * @param defaultTimeout Varsayılan istek zaman aşımı (ms)
   */
  constructor(
    protoLoader: ProtoLoader,
    connection: Connection,
    rateLimiter: RateLimiter,
    playerId: string,
    playerToken: number,
    defaultTimeout: number = 10000
  ) {
    this.protoLoader = protoLoader;
    this.connection = connection;
    this.rateLimiter = rateLimiter;
    this.playerId = playerId;
    this.playerToken = playerToken;
    this.defaultTimeout = defaultTimeout;

    // Gelen mesajları dinle
    this.connection.on('message', (data: Buffer) => {
      this.handleMessage(data);
    });
  }

  /**
   * Rust+ sunucusuna istek gönderir ve yanıt bekler.
   * 
   * @param data AppRequest alan değerleri (getInfo: {}, getMap: {} vb.)
   * @param commandName Komut adı (token maliyeti için: 'getInfo', 'getMap' vb.)
   * @param timeout Zaman aşımı süresi (ms)
   * @returns Sunucu yanıtı (AppResponse)
   * @throws Zaman aşımı, bağlantı hatası veya sunucu hatası
   */
  public async sendRequest<T extends AppResponse = AppResponse>(
    data: Record<string, unknown>,
    commandName?: string,
    timeout?: number
  ): Promise<T> {
    // Rate limit kontrolü
    const cost = commandName ? (TOKEN_COSTS[commandName] ?? 1) : 1;
    const hasTokens = await this.rateLimiter.waitForTokens(cost);
    if (!hasTokens) {
      throw new Error(`Rate limit: ${cost} token için zaman aşımına uğrandı`);
    }

    // Sequence numarası oluştur
    const currentSeq = ++this.seq;

    // Protobuf mesajı oluştur
    const requestData = {
      seq: currentSeq,
      playerId: this.playerId,
      playerToken: this.playerToken,
      ...data,
    };

    const encoded = this.protoLoader.encodeRequest(requestData);

    // Promise oluştur ve bekleyen istekler listesine ekle
    return new Promise<T>((resolve, reject) => {
      const timeoutMs = timeout ?? this.defaultTimeout;

      const timer = setTimeout(() => {
        this.pendingRequests.delete(currentSeq);
        reject(new Error(`İstek zaman aşımı (seq: ${currentSeq}, ${timeoutMs}ms)`));
      }, timeoutMs);

      this.pendingRequests.set(currentSeq, {
        resolve: resolve as (value: AppResponse) => void,
        reject,
        timer,
      });

      // Mesajı gönder
      try {
        this.connection.send(encoded);
      } catch (error) {
        clearTimeout(timer);
        this.pendingRequests.delete(currentSeq);
        reject(error);
      }
    });
  }

  /**
   * Yanıt beklemeden istek gönderir (fire-and-forget).
   * sendTeamMessage, setEntityValue gibi yanıt gerektirmeyen komutlar için.
   * 
   * @param data AppRequest alan değerleri
   * @param commandName Komut adı (token maliyeti için)
   */
  public async sendRequestNoResponse(data: Record<string, unknown>, commandName?: string): Promise<void> {
    const cost = commandName ? (TOKEN_COSTS[commandName] ?? 1) : 1;
    const hasTokens = await this.rateLimiter.waitForTokens(cost);
    if (!hasTokens) {
      throw new Error(`Rate limit: ${cost} token için zaman aşımına uğrandı`);
    }

    const currentSeq = ++this.seq;

    const requestData = {
      seq: currentSeq,
      playerId: this.playerId,
      playerToken: this.playerToken,
      ...data,
    };

    const encoded = this.protoLoader.encodeRequest(requestData);
    this.connection.send(encoded);
  }

  /**
   * Sunucudan gelen mesajı işler.
   * Yanıt ise bekleyen isteği resolve eder.
   * Broadcast ise null döner (dışarıdan yönetilir).
   * 
   * @param data Sunucudan gelen binary veri
   * @returns İşlenmiş AppMessage veya null
   */
  private handleMessage(data: Buffer): void {
    try {
      const message = this.protoLoader.decodeMessage(data);

      // Yanıt mı kontrol et (response.seq ile eşleştir)
      if (message.response && message.response.seq) {
        const pending = this.pendingRequests.get(message.response.seq);
        if (pending) {
          clearTimeout(pending.timer);
          this.pendingRequests.delete(message.response.seq);

          // Hata kontrolü
          if (message.response.error && message.response.error.error) {
            pending.reject(new Error(`Sunucu hatası: ${message.response.error.error}`));
          } else {
            pending.resolve(message.response);
          }
          return;
        }
      }

      // Bu noktada mesaj bir broadcast (teamChanged, entityChanged vb.)
      // RustClient tarafından işlenir
    } catch (error) {
      // Decode hatası - sessizce geç (corrupt mesaj)
    }
  }

  /**
   * Sunucudan gelen ham mesajı decode eder.
   * RustClient broadcast event'lerini işlemek için kullanır.
   * 
   * @param data Sunucudan gelen binary veri
   * @returns Çözümlenmiş mesaj
   */
  public decodeMessage(data: Buffer): import('./types').AppMessage {
    return this.protoLoader.decodeMessage(data);
  }

  /**
   * Tüm bekleyen istekleri iptal eder.
   * Bağlantı kapandığında çağrılır.
   */
  public cancelAllPending(): void {
    for (const [seq, pending] of this.pendingRequests) {
      clearTimeout(pending.timer);
      pending.reject(new Error('Bağlantı kapatıldı'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Bekleyen istek sayısını döner.
   */
  public getPendingCount(): number {
    return this.pendingRequests.size;
  }
}
