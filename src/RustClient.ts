/**
 * @fileoverview Rust+ Platform SDK ana istemci sınıfı.
 * 
 * Tüm Rust+ sunucu etkileşimlerini tek bir API altında birleştirir:
 * - Bağlantı yönetimi (connect/disconnect/reconnect)
 * - Sunucu bilgi sorgulama (getInfo, getTime, getMap, getTeam)
 * - Entity kontrolü (getEntityInfo, setEntityValue)
 * - Mesajlaşma (sendTeamMessage, getTeamChat)
 * - Canlı event dinleme (teamChanged, entityChanged, teamMessage)
 * 
 * @example
 * ```typescript
 * import { RustClient } from '@rustplus-platform/core';
 * 
 * const client = new RustClient({
 *   serverIp: '123.456.789.0',
 *   serverPort: 28083,
 *   steamId: '76561198012345678',
 *   playerToken: 1234567890,
 * });
 * 
 * await client.connect();
 * 
 * const info = await client.getInfo();
 * console.log(`Sunucu: ${info.name}, Oyuncular: ${info.players}/${info.maxPlayers}`);
 * 
 * client.on('teamMessage', (msg) => {
 *   console.log(`[${msg.name}]: ${msg.message}`);
 * });
 * 
 * client.on('entityChanged', (data) => {
 *   console.log(`Entity ${data.entityId} değişti:`, data.payload);
 * });
 * ```
 */

import { EventEmitter } from 'events';
import {
  RustClientOptions,
  ConnectionState,
  ServerInfo,
  GameTime,
  MapData,
  TeamInfo,
  TeamChat,
  MapMarkers,
  EntityInfo,
  ClanInfoResponse,
  ClanChat,
  CameraInfo,
  AppResponse,
  RustClientEvents,
} from './types';
import { Config } from './config/Config';
import { VersionProvider } from './config/VersionProvider';
import { Connection } from './Connection';
import { ProtoLoader } from './proto/ProtoLoader';
import { RequestManager } from './RequestManager';
import { RateLimiter } from './RateLimiter';
import { EventManager } from './events/EventManager';

type RequiredResponse<K extends keyof AppResponse> = AppResponse & {
  [P in K]-?: NonNullable<AppResponse[P]>;
};

/**
 * Rust+ sunucusu ile tüm etkileşimleri yöneten ana istemci sınıfı.
 * 
 * EventEmitter tabanlı — tüm sunucu olayları event olarak yayınlanır.
 * Promise tabanlı — tüm komutlar async/await ile kullanılır.
 */
export class RustClient extends EventEmitter {
  public on<K extends keyof RustClientEvents>(eventName: K, listener: RustClientEvents[K]): this;
  public on(eventName: string | symbol, listener: (...args: any[]) => void): this {
    return super.on(eventName, listener);
  }

  /** SDK yapılandırması */
  private config: Config;
  /** Facepunch sürüm sağlayıcısı */
  private versionProvider: VersionProvider;
  /** WebSocket bağlantı yöneticisi */
  private connection: Connection;
  /** Protobuf encode/decode */
  private protoLoader: ProtoLoader;
  /** İstek-yanıt yöneticisi */
  private requestManager!: RequestManager;
  /** Rate limiter */
  private rateLimiter: RateLimiter;
  /** Broadcast event yöneticisi */
  private eventManager!: EventManager;
  private managersInitialized: boolean = false;
  private connectPromise: Promise<void> | null = null;

  /** İstemci seçenekleri */
  private options: Required<Pick<RustClientOptions, 'serverIp' | 'serverPort' | 'steamId' | 'playerToken'>> & RustClientOptions;

  /**
   * Yeni bir RustClient oluşturur.
   * 
   * @param options Bağlantı ve yapılandırma seçenekleri
   * 
   * @example
   * ```typescript
   * const client = new RustClient({
   *   serverIp: '123.456.789.0',
   *   serverPort: 28083,
   *   steamId: '76561198012345678',
   *   playerToken: 1234567890,
   * });
   * ```
   */
  constructor(options: RustClientOptions) {
    super();
    this.options = options as any;

    // Yapılandırma katmanını oluştur
    this.config = new Config();
    this.versionProvider = new VersionProvider(this.config);

    // Rate limiter oluştur
    this.rateLimiter = new RateLimiter(
      options.rateLimiter ?? this.config.defaultRateLimiter
    );

    // Protobuf yükleyici oluştur
    this.protoLoader = new ProtoLoader();

    // WebSocket bağlantı yöneticisi oluştur
    this.connection = new Connection(
      options.serverIp,
      options.serverPort,
      this.config,
      this.versionProvider,
      options.useFacepunchProxy ?? false,
      options.autoReconnect ?? true,
      options.reconnectInterval
    );

    // Connection event'lerini client'a yönlendir
    this.setupConnectionEvents();
  }

  /**
   * Connection event'lerini RustClient event'lerine yönlendirir.
   */
  private setupConnectionEvents(): void {
    this.connection.on('connecting', () => {
      this.emit('connecting');
    });

    this.connection.on('connected', () => {
      this.rateLimiter.start();
      this.emit('connected');
    });

    this.connection.on('disconnected', () => {
      // Bekleyen tüm istekleri iptal et
      if (this.requestManager) {
        this.requestManager.cancelAllPending();
      }
      this.rateLimiter.stop();
      this.emit('disconnected');
    });

    this.connection.on('reconnecting', (attempt: number) => {
      this.emit('reconnecting', attempt);
    });

    this.connection.on('error', (error: Error) => {
      this.emit('error', error);
    });
  }

  /**
   * Rust+ sunucusuna bağlanır.
   * 
   * Bu metod şunları sırayla yapar:
   * 1. Protobuf şemasını yükler
   * 2. WebSocket bağlantısı kurar
   * 3. RequestManager ve EventManager'ı başlatır
   * 4. Rate limiter'ı başlatır
   * 
   * @throws Bağlantı kurulamazsa hata fırlatır
   * 
   * @example
   * ```typescript
   * await client.connect();
   * console.log('Bağlandı!');
   * ```
   */
  public async connect(): Promise<void> {
    if (this.connection.isConnected()) {
      return;
    }

    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.performConnect();

    try {
      await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  private async performConnect(): Promise<void> {
    // 1. Protobuf şemasını yükle
    await this.protoLoader.load();

    if (!this.managersInitialized) {
      // 2. RequestManager oluştur (protobuf yüklendikten sonra)
      this.requestManager = new RequestManager(
        this.protoLoader,
        this.connection,
        this.rateLimiter,
        this.options.steamId,
        this.options.playerToken,
        this.options.requestTimeout ?? this.config.defaultRequestTimeout
      );

      // 3. EventManager oluştur
      this.eventManager = new EventManager(this, this.protoLoader);

      // 4. Connection'dan gelen broadcast mesajları EventManager'a yönlendir
      this.connection.on('message', (data: Buffer) => {
        this.eventManager.handleMessage(data);
      });

      this.managersInitialized = true;
    }

    // 5. WebSocket bağlantısını kur
    try {
      await this.connection.connect();
    } catch (error) {
      this.rateLimiter.stop();
      throw error;
    }

    // 6. Bağlantıyı uyandır (Python SDK referansı: connect sonrası getTime çağrısı)
    try {
      await this.getTime();
    } catch {
      // İlk wake-up başarısız olabilir, bağlantı yine de açık
    }
  }

  /**
   * Bağlantıyı kapatır.
   * Rate limiter'ı durdurur ve bekleyen istekleri iptal eder.
   */
  public disconnect(): void {
    this.rateLimiter.stop();
    if (this.requestManager) {
      this.requestManager.cancelAllPending();
    }
    this.connection.disconnect();
  }

  /**
   * Bağlı olup olmadığını kontrol eder.
   */
  public isConnected(): boolean {
    return this.connection.isConnected();
  }

  /**
   * Bağlantı durumunu döner.
   */
  public getConnectionState(): ConnectionState {
    return this.connection.getState();
  }

  // =====================================================
  // BİLGİ KOMUTLARI
  // =====================================================

  /**
   * Sunucu bilgilerini çeker.
   * Sunucu adı, harita, oyuncu sayısı, seed gibi bilgileri döner.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppInfo nesnesi
   * 
   * @example
   * ```typescript
   * const info = await client.getInfo();
   * console.log(`Sunucu: ${info.name}`);
   * console.log(`Oyuncular: ${info.players}/${info.maxPlayers}`);
   * console.log(`Harita boyutu: ${info.mapSize}`);
   * ```
   */
  public async getInfo(timeout?: number): Promise<ServerInfo> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'info'>>(
      { getInfo: {} },
      'getInfo',
      timeout
    );
    return response.info;
  }

  /**
   * Oyun içi saati çeker.
   * Gün uzunluğu, gündoğumu, günbatımı ve mevcut saat bilgisi döner.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppTime nesnesi
   * 
   * @example
   * ```typescript
   * const time = await client.getTime();
   * console.log(`Saat: ${time.time}`);
   * console.log(`Gündoğumu: ${time.sunrise}, Günbatımı: ${time.sunset}`);
   * ```
   */
  public async getTime(timeout?: number): Promise<GameTime> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'time'>>(
      { getTime: {} },
      'getTime',
      timeout
    );
    return response.time;
  }

  /**
   * Harita verilerini çeker.
   * JPG görüntü, boyut, anıtlar (monuments) ve okyanus kenar boşluğu döner.
   * 
   * DİKKAT: Bu komut 5 token tüketir (diğerleri 1 token).
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 30000 (harita büyük veri)
   * @returns AppMap nesnesi (jpgImage, width, height, monuments)
   * 
   * @example
   * ```typescript
   * const map = await client.getMap(30000);
   * console.log(`Harita: ${map.width}x${map.height}`);
   * // map.jpgImage -> Buffer olarak harita görseli
   * ```
   */
  public async getMap(timeout: number = 30000): Promise<MapData> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'map'>>(
      { getMap: {} },
      'getMap',
      timeout
    );
    return response.map;
  }

  /**
   * Takım bilgilerini çeker.
   * Takım lideri, üyeler, pozisyonlar, çevrimiçi durumu gibi bilgileri döner.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppTeamInfo nesnesi
   * 
   * @example
   * ```typescript
   * const team = await client.getTeamInfo();
   * for (const member of team.members) {
   *   console.log(`${member.name}: ${member.isOnline ? '🟢' : '🔴'} (${member.x}, ${member.y})`);
   * }
   * ```
   */
  public async getTeamInfo(timeout?: number): Promise<TeamInfo> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'teamInfo'>>(
      { getTeamInfo: {} },
      'getTeamInfo',
      timeout
    );
    return response.teamInfo;
  }

  /**
   * Takım sohbet geçmişini çeker.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppTeamChat nesnesi (messages dizisi)
   * 
   * @example
   * ```typescript
   * const chat = await client.getTeamChat();
   * for (const msg of chat.messages) {
   *   console.log(`[${msg.name}]: ${msg.message}`);
   * }
   * ```
   */
  public async getTeamChat(timeout?: number): Promise<TeamChat> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'teamChat'>>(
      { getTeamChat: {} },
      'getTeamChat',
      timeout
    );
    return response.teamChat;
  }

  /**
   * Harita işaretçilerini (markers) çeker.
   * Oyuncular, patlamalar, vending machine'ler, helikopter, kargo vb.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppMapMarkers nesnesi (markers dizisi)
   * 
   * @example
   * ```typescript
   * const markers = await client.getMapMarkers();
   * for (const marker of markers.markers) {
   *   console.log(`[${marker.type}] ${marker.name} @ (${marker.x}, ${marker.y})`);
   * }
   * ```
   */
  public async getMapMarkers(timeout?: number): Promise<MapMarkers> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'mapMarkers'>>(
      { getMapMarkers: {} },
      'getMapMarkers',
      timeout
    );
    return response.mapMarkers;
  }

  // =====================================================
  // ENTITY KOMUTLARI
  // =====================================================

  /**
   * Belirli bir entity'nin (switch, alarm, storage monitor) bilgisini çeker.
   * 
   * @param entityId Entity ID değeri
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppEntityInfo nesnesi (type, payload)
   * 
   * @example
   * ```typescript
   * const entity = await client.getEntityInfo(12345);
   * console.log(`Tür: ${entity.type}, Değer: ${entity.payload.value}`);
   * ```
   */
  public async getEntityInfo(entityId: number, timeout?: number): Promise<EntityInfo> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'entityInfo'>>(
      { entityId, getEntityInfo: {} },
      'getEntityInfo',
      timeout
    );
    return response.entityInfo;
  }

  /**
   * Entity değerini ayarlar (switch aç/kapa, alarm tetikle vb.).
   * 
   * @param entityId Entity ID değeri
   * @param value true = aç, false = kapa
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * 
   * @example
   * ```typescript
   * // Akıllı şalteri aç
   * await client.setEntityValue(12345, true);
   * // Akıllı şalteri kapa
   * await client.setEntityValue(12345, false);
   * ```
   */
  public async setEntityValue(entityId: number, value: boolean, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { entityId, setEntityValue: { value } },
      'setEntityValue',
      timeout
    );
    return response;
  }

  // =====================================================
  // MESAJLAŞMA KOMUTLARI
  // =====================================================

  /**
   * Takım sohbetine mesaj gönderir.
   * 
   * DİKKAT: Bu komut 2 token tüketir.
   * 
   * @param message Gönderilecek mesaj
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * 
   * @example
   * ```typescript
   * await client.sendTeamMessage('Merhaba takım!');
   * ```
   */
  public async sendTeamMessage(message: string, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { sendTeamMessage: { message } },
      'sendTeamMessage',
      timeout
    );
    return response;
  }

  // =====================================================
  // ABONELİK KOMUTLARI
  // =====================================================

  /**
   * Bir entity'ye abone olur (değişiklik bildirimi almak için).
   * 
   * @param entityId Entity ID değeri
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * 
   * @example
   * ```typescript
   * await client.subscribe(12345);
   * client.on('entityChanged', (data) => {
   *   if (data.entityId === 12345) {
   *     console.log('Şalter durumu değişti:', data.payload.value);
   *   }
   * });
   * ```
   */
  public async subscribe(entityId: number, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { entityId, setSubscription: { value: true } },
      'setSubscription',
      timeout
    );
    return response;
  }

  /**
   * Bir entity aboneliğini iptal eder.
   * 
   * @param entityId Entity ID değeri
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async unsubscribe(entityId: number, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { entityId, setSubscription: { value: false } },
      'setSubscription',
      timeout
    );
    return response;
  }

  // =====================================================
  // TAKIM YÖNETİMİ
  // =====================================================

  /**
   * Takım liderliğini başka bir oyuncuya devreder.
   * 
   * @param steamId Lider yapılacak oyuncunun Steam ID'si
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async promoteToLeader(steamId: string, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { promoteToLeader: { steamId } },
      'promoteToLeader',
      timeout
    );
    return response;
  }

  // =====================================================
  // KLAN KOMUTLARI
  // =====================================================

  /**
   * Klan bilgilerini çeker.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppClanInfo nesnesi
   */
  public async getClanInfo(timeout?: number): Promise<ClanInfoResponse> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'clanInfo'>>(
      { getClanInfo: {} },
      'getClanInfo',
      timeout
    );
    return response.clanInfo;
  }

  /**
   * Klan sohbet geçmişini çeker.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppClanChat nesnesi
   */
  public async getClanChat(timeout?: number): Promise<ClanChat> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'clanChat'>>(
      { getClanChat: {} },
      'getClanChat',
      timeout
    );
    return response.clanChat;
  }

  /**
   * Klan sohbetine mesaj gönderir.
   * 
   * @param message Gönderilecek mesaj
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async sendClanMessage(message: string, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { sendClanMessage: { message } },
      'sendClanMessage',
      timeout
    );
    return response;
  }

  /**
   * Klan MOTD (Günün Mesajı) metnini ayarlar.
   * 
   * @param message Yeni MOTD metni
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async setClanMotd(message: string, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { setClanMotd: { message } },
      'setClanMotd',
      timeout
    );
    return response;
  }

  // =====================================================
  // KAMERA KOMUTLARI
  // =====================================================

  /**
   * Bir CCTV kamerasına abone olur ve kamera bilgilerini döner.
   * Kamera görüntü verileri 'cameraRays' event'i ile gelir.
   * 
   * @param cameraId Kamera tanımlayıcısı (ör: 'OILRIG1', 'DOME1', veya özel isim)
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   * @returns AppCameraInfo nesnesi (width, height, nearPlane, farPlane)
   * 
   * @example
   * ```typescript
   * const camInfo = await client.subscribeToCamera('DOME1');
   * console.log(`Kamera: ${camInfo.width}x${camInfo.height}`);
   * 
   * client.on('cameraRays', (rays) => {
   *   // Kamera görüntü verisi
   * });
   * ```
   */
  public async subscribeToCamera(cameraId: string, timeout?: number): Promise<CameraInfo> {
    const response = await this.requestManager.sendRequest<RequiredResponse<'cameraSubscribeInfo'>>(
      { cameraSubscribe: { cameraId } },
      'cameraSubscribe',
      timeout
    );
    return response.cameraSubscribeInfo;
  }

  /**
   * Kamera aboneliğini iptal eder.
   * 
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async unsubscribeFromCamera(timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { cameraUnsubscribe: {} },
      'cameraUnsubscribe',
      timeout
    );
    return response;
  }

  /**
   * Kameraya kontrol girişi gönderir (fare hareketi, tuş basma).
   * 
   * @param buttons Basılı olan düğme bitmask'ı
   * @param mouseDeltaX Fare X delta hareketi
   * @param mouseDeltaY Fare Y delta hareketi
   * @param timeout Zaman aşımı (ms), varsayılan: 10000
   */
  public async sendCameraInput(buttons: number, mouseDeltaX: number, mouseDeltaY: number, timeout?: number): Promise<AppResponse> {
    const response = await this.requestManager.sendRequest(
      { cameraInput: { buttons, mouseDelta: { x: mouseDeltaX, y: mouseDeltaY } } },
      'cameraInput',
      timeout
    );
    return response;
  }

  // =====================================================
  // SUNUCU DEĞİŞTİRME
  // =====================================================

  /**
   * Mevcut bağlantıyı kapatıp farklı bir sunucuya bağlanır.
   * Bekleyen istekler iptal edilir, rate limiter sıfırlanır.
   * 
   * @param newOptions Yeni sunucu bağlantı bilgileri
   * 
   * @example
   * ```typescript
   * await client.switchServer({
   *   serverIp: '987.654.321.0',
   *   serverPort: 28083,
   *   steamId: '76561198012345678',
   *   playerToken: 9876543210,
   * });
   * ```
   */
  public async switchServer(newOptions: RustClientOptions): Promise<void> {
    // 1. Mevcut bağlantıyı temizle
    this.disconnect();

    // 2. Event listener'ları temizle (eski connection'dan)
    this.connection.removeAllListeners();
    this.managersInitialized = false;

    // 3. Yeni seçenekleri kaydet
    this.options = newOptions as any;

    // 4. Yeni bağlantı bileşenlerini oluştur
    this.connection = new Connection(
      newOptions.serverIp,
      newOptions.serverPort,
      this.config,
      this.versionProvider,
      newOptions.useFacepunchProxy ?? false,
      newOptions.autoReconnect ?? true,
      newOptions.reconnectInterval
    );

    // 5. Rate limiter sıfırla
    this.rateLimiter.reset();

    // 6. Connection event'lerini yeniden bağla
    this.setupConnectionEvents();

    // 7. Yeni sunucuya bağlan
    await this.connect();
  }

  // =====================================================
  // YARDIMCI METOTLAR
  // =====================================================

  /**
   * Akıllı şalteri açar (kısa yol).
   * 
   * @param entityId Şalter entity ID'si
   * @param timeout Zaman aşımı (ms)
   */
  public async turnSmartSwitchOn(entityId: number, timeout?: number): Promise<AppResponse> {
    return this.setEntityValue(entityId, true, timeout);
  }

  /**
   * Akıllı şalteri kapatır (kısa yol).
   * 
   * @param entityId Şalter entity ID'si
   * @param timeout Zaman aşımı (ms)
   */
  public async turnSmartSwitchOff(entityId: number, timeout?: number): Promise<AppResponse> {
    return this.setEntityValue(entityId, false, timeout);
  }

  /**
   * Yanıtın geçerli olup olmadığını kontrol eder.
   * 
   * @param response Kontrol edilecek yanıt
   * @returns Geçerliyse true
   */
  public isResponseValid(response: unknown): boolean {
    if (response === undefined || response === null) return false;
    if (typeof response !== 'object') return true;
    if ('error' in response && response.error) return false;
    if (Object.keys(response).length === 0) return false;
    return true;
  }
}
