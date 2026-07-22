/**
 * @fileoverview WebSocket bağlantı yönetimi.
 * Rust+ sunucusuna WebSocket üzerinden bağlanma, mesaj gönderme/alma,
 * otomatik yeniden bağlanma (exponential backoff) ve bağlantı durumu
 * yönetimini sağlar.
 */

import { EventEmitter } from 'events';
import WebSocket from 'ws';
import { ConnectionState } from './types';
import { Config } from './config/Config';
import { VersionProvider } from './config/VersionProvider';

/**
 * Connection event tipleri
 */
export interface ConnectionEvents {
  connecting: () => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
  message: (data: Buffer) => void;
  error: (error: Error) => void;
}

/**
 * Rust+ sunucusuna WebSocket bağlantısı yöneten sınıf.
 * 
 * Özellikler:
 * - Doğrudan veya Facepunch proxy üzerinden bağlantı
 * - ?v= sürüm parametresi (VersionProvider üzerinden)
 * - Exponential backoff ile otomatik yeniden bağlanma
 * - Bağlantı durumu izleme
 */
export class Connection extends EventEmitter {
  private ws: WebSocket | null = null;
  private config: Config;
  private versionProvider: VersionProvider;
  private state: ConnectionState = ConnectionState.DISCONNECTED;

  /** Sunucu bağlantı bilgileri */
  private serverIp: string;
  private serverPort: number;
  private useFacepunchProxy: boolean;

  /** Yeniden bağlanma yönetimi */
  private autoReconnect: boolean;
  private reconnectAttempt: number = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private reconnectInterval: number;
  private maxReconnectInterval: number;
  private connectPromise: Promise<void> | null = null;
  private manuallyDisconnected: boolean = false;
  private pendingConnectReject: ((error: Error) => void) | null = null;

  /**
   * @param serverIp Rust sunucu IP adresi
   * @param serverPort Rust+ uygulama portu
   * @param config SDK yapılandırması
   * @param versionProvider Sürüm bilgisi sağlayıcısı
   * @param useFacepunchProxy Facepunch proxy kullanılsın mı?
   * @param autoReconnect Otomatik yeniden bağlanma aktif mi?
   * @param reconnectInterval Yeniden bağlanma aralığı (ms)
   */
  constructor(
    serverIp: string,
    serverPort: number,
    config: Config,
    versionProvider: VersionProvider,
    useFacepunchProxy: boolean = false,
    autoReconnect: boolean = true,
    reconnectInterval?: number
  ) {
    super();
    this.serverIp = serverIp;
    this.serverPort = serverPort;
    this.config = config;
    this.versionProvider = versionProvider;
    this.useFacepunchProxy = useFacepunchProxy;
    this.autoReconnect = autoReconnect;
    this.reconnectInterval = reconnectInterval ?? config.defaultReconnectInterval;
    this.maxReconnectInterval = config.maxReconnectInterval;
  }

  /**
   * Sunucuya WebSocket bağlantısı kurar.
   * @throws Bağlantı kurulamazsa hata fırlatır
   */
  public async connect(): Promise<void> {
    if (this.state === ConnectionState.CONNECTED) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.manuallyDisconnected = false;
    this.connectPromise = this.performConnect();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async performConnect(): Promise<void> {

    this.state = ConnectionState.CONNECTING;
    this.emit('connecting');

    try {
      // Sürüm bilgisini al
      const version = await this.versionProvider.getVersion();
      
      // WebSocket URL oluştur
      const url = this.config.buildWebSocketUrl(
        this.serverIp,
        this.serverPort,
        this.useFacepunchProxy,
        version
      );

      // WebSocket bağlantısı kur
      await this.createWebSocket(url);
    } catch (error) {
      this.state = ConnectionState.DISCONNECTED;
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      // Bağlantı başarısız olduğunda da otomatik reconnect döngüsünün devam etmesini sağla
      this.cleanupFailedSocket();
      this.handleDisconnect();
      throw err;
    }
  }

  private cleanupFailedSocket(): void {
    if (!this.ws) return;

    const socket = this.ws;
    socket.removeAllListeners();
    if (socket.readyState !== WebSocket.CLOSED) {
      socket.terminate();
    }
    this.ws = null;
  }

  /**
   * WebSocket nesnesini oluşturur ve event listener'ları bağlar.
   * @param url WebSocket bağlantı URL'si
   */
  private createWebSocket(url: string): Promise<void> {
    return new Promise<void>((resolve, reject) => {
      let socket: WebSocket;

      try {
        socket = new WebSocket(url);
        this.ws = socket;
      } catch (error) {
        reject(error);
        return;
      }

      const onOpen = () => {
        this.state = ConnectionState.CONNECTED;
        this.reconnectAttempt = 0;
        this.pendingConnectReject = null;
        cleanup();
        this.setupListeners();
        this.emit('connected');
        resolve();
      };

      const onError = (error: Error) => {
        this.pendingConnectReject = null;
        cleanup();
        reject(error);
      };

      const onClose = () => {
        this.pendingConnectReject = null;
        cleanup();
        reject(new Error('WebSocket bağlantısı hemen kapandı'));
      };

      const cleanup = () => {
        socket.removeListener('open', onOpen);
        socket.removeListener('error', onError);
        socket.removeListener('close', onClose);
      };

      socket.once('open', onOpen);
      socket.once('error', onError);
      socket.once('close', onClose);
      this.pendingConnectReject = (error: Error) => {
        this.pendingConnectReject = null;
        cleanup();
        reject(error);
      };
    });
  }

  /**
   * Bağlantı kurulduktan sonra kalıcı listener'ları ayarlar.
   */
  private setupListeners(): void {
    if (!this.ws) return;

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        // Buffer'a dönüştür
        const buffer = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);
        this.emit('message', buffer);
      } catch (error) {
        this.emit('error', error instanceof Error ? error : new Error(String(error)));
      }
    });

    this.ws.on('close', () => {
      this.state = ConnectionState.DISCONNECTED;
      this.emit('disconnected');
      this.handleDisconnect();
    });

    this.ws.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Bağlantı koptuğunda otomatik yeniden bağlanmayı yönetir.
   * Exponential backoff kullanır.
   */
  private handleDisconnect(): void {
    if (!this.autoReconnect || this.manuallyDisconnected || this.reconnectTimer) return;

    this.reconnectAttempt++;
    
    // Exponential backoff hesapla
    const delay = Math.min(
      this.reconnectInterval * Math.pow(2, this.reconnectAttempt - 1),
      this.maxReconnectInterval
    );

    this.state = ConnectionState.RECONNECTING;
    this.emit('reconnecting', this.reconnectAttempt);

    this.reconnectTimer = setTimeout(async () => {
      this.reconnectTimer = null;
      try {
        await this.connect();
      } catch (error) {
        // connect() içinde hata emit edilir, burada sadece sessizce devam
      }
    }, delay);
  }

  /**
   * Bağlantıyı kapatır.
   * Otomatik yeniden bağlanmayı da durdurur.
   */
  public disconnect(): void {
    const shouldEmitDisconnected = this.state !== ConnectionState.DISCONNECTED || this.ws !== null;
    this.manuallyDisconnected = true;

    if (this.pendingConnectReject) {
      this.pendingConnectReject(new Error('Bağlantı kullanıcı tarafından kapatıldı'));
    }

    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      // Tüm listener'ları temizle
      this.ws.removeAllListeners();

      if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
        this.ws.close();
      }
      this.ws.terminate();
      this.ws = null;
    }

    this.state = ConnectionState.DISCONNECTED;
    if (shouldEmitDisconnected) {
      this.emit('disconnected');
    }
  }

  /**
   * WebSocket üzerinden ham veri gönderir.
   * @param data Gönderilecek binary veri
   * @throws Bağlı değilse hata fırlatır
   */
  public send(data: Uint8Array | Buffer): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket bağlı değil. Önce connect() çağrın.');
    }
    this.ws.send(data);
  }

  /**
   * Mevcut bağlantı durumunu döner.
   */
  public getState(): ConnectionState {
    return this.state;
  }

  /**
   * Bağlı olup olmadığını kontrol eder.
   */
  public isConnected(): boolean {
    return this.state === ConnectionState.CONNECTED && 
           this.ws !== null && 
           this.ws.readyState === WebSocket.OPEN;
  }
}
