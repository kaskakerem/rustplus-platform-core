/**
 * @fileoverview FCM Push bildirim dinleyicisi ile sunucu/cihaz eşleştirme.
 * 
 * Rust+ uygulaması, oyun içinde "Pair with Server" veya "Pair with Device"
 * yapıldığında Google FCM push bildirimi gönderir. Bu sınıf o bildirimleri
 * dinleyerek steamId, playerToken, serverIp, serverPort gibi bilgileri
 * otomatik olarak yakalar.
 * 
 * NOT: Bu modül `@liamcottle/push-receiver` paketine ihtiyaç duyar.
 * Bu paket SDK'nın zorunlu bağımlılığı değildir (opsiyonel).
 * 
 * @example
 * ```typescript
 * import { PairingListener } from '@rustplus-platform/core';
 * 
 * const pairing = new PairingListener({
 *   androidId: '1234567890',
 *   securityToken: '9876543210',
 * });
 * 
 * pairing.on('serverPaired', (server) => {
 *   console.log(`Sunucu eşleştirildi: ${server.name} (${server.ip}:${server.port})`);
 *   console.log(`Steam ID: ${server.steamId}, Token: ${server.playerToken}`);
 * });
 * 
 * pairing.on('entityPaired', (entity) => {
 *   console.log(`Cihaz eşleştirildi: ${entity.name} (${entity.type})`);
 * });
 * 
 * await pairing.start();
 * ```
 */

import { EventEmitter } from 'events';

/**
 * FCM push bildirim kimlik bilgileri.
 * Bu bilgiler ilk kayıt sırasında alınır ve saklanmalıdır.
 */
export interface FcmCredentials {
  /** GCM/FCM Android ID */
  androidId: string;
  /** GCM/FCM güvenlik tokenı */
  securityToken: string;
}

/**
 * Sunucu eşleştirme bildirimi verisi.
 */
export interface ServerPairingData {
  /** Sunucu IP adresi */
  ip: string;
  /** Sunucu Rust+ portu */
  port: number;
  /** Sunucu adı */
  name: string;
  /** Sunucu açıklaması */
  description: string | null;
  /** Sunucu başlık görseli URL'si */
  headerImage: string | null;
  /** Sunucu logo URL'si */
  logo: string | null;
  /** Sunucu web URL'si */
  url: string | null;
  /** Oyuncunun Steam ID'si (bağlantı için gerekli) */
  steamId: string;
  /** Oyuncu tokenı (bağlantı için gerekli) */
  playerToken: number;
  /** Sunucu ID'si */
  serverId: string | null;
}

/**
 * Entity eşleştirme bildirimi verisi.
 */
export interface EntityPairingData {
  /** Entity ID */
  entityId: number;
  /** Entity adı (örn: "Smart Switch", "Smart Alarm") */
  entityName: string;
  /** Kullanıcının verdiği özel isim */
  customName: string;
  /** Entity türü ('switch' | 'alarm' | 'storageMonitor' | 'unknown') */
  type: string;
  /** Sunucu IP'si */
  serverIp: string;
  /** Sunucu portu */
  serverPort: number;
}

/**
 * PairingListener event tipleri.
 */
export interface PairingListenerEvents {
  /** Sunucu eşleştirme bildirimi geldiğinde */
  serverPaired: (data: ServerPairingData) => void;
  /** Entity (cihaz) eşleştirme bildirimi geldiğinde */
  entityPaired: (data: EntityPairingData) => void;
  /** Alarm bildirimi geldiğinde */
  alarm: (data: { title: string; message: string; body: any }) => void;
  /** Bağlantı hatası */
  error: (error: Error) => void;
}

/**
 * FCM push bildirimlerini dinleyerek Rust+ sunucu ve cihaz
 * eşleştirme verilerini yakalayan sınıf.
 * 
 * Veritabanından tamamen bağımsızdır — gelen verileri event olarak yayınlar,
 * kaydetme sorumluluğu kullanıcıya aittir.
 */
export class PairingListener extends EventEmitter {
  private credentials: FcmCredentials;
  private client: any = null;
  private isRunning: boolean = false;

  /**
   * @param credentials FCM kimlik bilgileri
   */
  constructor(credentials: FcmCredentials) {
    super();
    this.credentials = credentials;
  }

  /**
   * FCM push bildirim dinlemeyi başlatır.
   * 
   * @throws push-receiver kütüphanesi yüklü değilse hata fırlatır
   */
  public async start(): Promise<void> {
    if (this.isRunning) return;

    // Opsiyonel bağımlılığı dinamik yükle
    let PushReceiverClient: any;
    try {
      PushReceiverClient = require('@liamcottle/push-receiver/src/client');
    } catch {
      throw new Error(
        'FCM dinleme için @liamcottle/push-receiver paketi gerekli. ' +
        'Yüklemek için: npm install @liamcottle/push-receiver'
      );
    }

    try {
      this.client = new PushReceiverClient(
        this.credentials.androidId,
        this.credentials.securityToken,
        []
      );

      this.client.on('ON_DATA_RECEIVED', (data: any) => {
        this.handleNotification(data);
      });

      this.client.connect();
      this.isRunning = true;
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.emit('error', err);
      throw err;
    }
  }

  /**
   * FCM dinlemeyi durdurur.
   */
  public stop(): void {
    if (this.client) {
      try {
        if (typeof this.client.destroy === 'function') {
          this.client.destroy();
        }
      } catch {
        // Sessizce geç
      }
      this.client = null;
    }
    this.isRunning = false;
  }

  /**
   * Dinleyicinin çalışıp çalışmadığını kontrol eder.
   */
  public isListening(): boolean {
    return this.isRunning;
  }

  /**
   * Gelen FCM bildirimini parse eder ve uygun event'i tetikler.
   */
  private handleNotification(notificationData: any): void {
    try {
      const appData = notificationData?.appData;
      if (!appData || !Array.isArray(appData)) return;

      const getItem = (key: string) => 
        appData.find((item: any) => item.key === key)?.value;

      const channelId = getItem('channelId');
      const title = getItem('title') || '';
      const message = getItem('message') || '';
      const bodyStr = getItem('body');

      if (!bodyStr) return;

      const body = typeof bodyStr === 'string' ? JSON.parse(bodyStr) : bodyStr;

      if (channelId === 'pairing') {
        this.handlePairing(body);
      } else if (channelId === 'alarm') {
        this.emit('alarm', { title, message, body });
      }
    } catch (error) {
      this.emit('error',
        error instanceof Error ? error : new Error(`Bildirim parse hatası: ${String(error)}`)
      );
    }
  }

  /**
   * Eşleştirme bildirimini türüne göre işler.
   */
  private handlePairing(body: any): void {
    const serverIp = body.ip;
    const serverPort = parseInt(body.port);

    if (!serverIp || !serverPort || isNaN(serverPort)) return;

    if (body.type === 'server') {
      const data: ServerPairingData = {
        ip: serverIp,
        port: serverPort,
        name: body.name || body.hostname || `Rust Server ${serverIp}`,
        description: body.desc || null,
        headerImage: body.img || null,
        logo: body.logo || null,
        url: body.url || null,
        steamId: body.playerId || '',
        playerToken: body.playerToken ? parseInt(body.playerToken) : 0,
        serverId: body.id || null,
      };
      this.emit('serverPaired', data);
    } else if (body.type === 'entity') {
      const entityName = body.entityName || 'Unknown';
      let entityType = 'unknown';
      if (entityName === 'Smart Switch') entityType = 'switch';
      else if (entityName === 'Smart Alarm') entityType = 'alarm';
      else if (entityName === 'Storage Monitor') entityType = 'storageMonitor';

      const data: EntityPairingData = {
        entityId: parseInt(body.entityId) || 0,
        entityName,
        customName: body.name || entityName,
        type: entityType,
        serverIp,
        serverPort,
      };
      this.emit('entityPaired', data);
    }
  }
}
