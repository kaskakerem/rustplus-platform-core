/**
 * @fileoverview Rust+ Platform SDK tip tanımları.
 * Tüm arayüzler (interfaces) ve tür (type) tanımları burada bulunur.
 */

/** SDK yapılandırma seçenekleri */
export interface RustClientOptions {
  /** Rust sunucu IP adresi */
  serverIp: string;
  /** Rust+ uygulama portu (app.port) */
  serverPort: number;
  /** Oyuncu Steam ID (64-bit string) */
  steamId: string;
  /** Sunucu eşleştirmeden alınan player token */
  playerToken: number;
  /** Facepunch proxy kullanılsın mı? (varsayılan: false) */
  useFacepunchProxy?: boolean;
  /** Otomatik yeniden bağlanma aktif mi? (varsayılan: true) */
  autoReconnect?: boolean;
  /** Yeniden bağlanma aralığı (ms) (varsayılan: 5000) */
  reconnectInterval?: number;
  /** İstek zaman aşımı (ms) (varsayılan: 10000) */
  requestTimeout?: number;
  /** Rate limiter yapılandırması */
  rateLimiter?: RateLimiterOptions;
}

/** Rate limiter yapılandırması */
export interface RateLimiterOptions {
  /** Maksimum token sayısı (varsayılan: 25) */
  maxTokens?: number;
  /** Saniyede yenilenen token sayısı (varsayılan: 3) */
  tokensPerSecond?: number;
}

/** Bağlantı durumu */
export enum ConnectionState {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  RECONNECTING = 'reconnecting'
}

/** İstek token maliyetleri */
export const TOKEN_COSTS: Record<string, number> = {
  getInfo: 1,
  getTime: 1,
  getMap: 5,
  getTeamInfo: 1,
  getTeamChat: 1,
  getMapMarkers: 1,
  getEntityInfo: 1,
  setEntityValue: 1,
  sendTeamMessage: 2,
  checkSubscription: 1,
  setSubscription: 1,
  promoteToLeader: 1,
  getClanInfo: 1,
  getClanChat: 1,
  sendClanMessage: 2,
  setClanMotd: 1,
  cameraSubscribe: 1,
  cameraUnsubscribe: 1,
  cameraInput: 1,
} as const;

/** Entity türleri (proto enum'dan) */
export enum EntityType {
  Unknown = 0,
  Switch = 1,
  Alarm = 2,
  StorageMonitor = 3
}

/** Harita marker türleri (proto enum'dan) */
export enum MarkerType {
  Undefined = 0,
  Player = 1,
  Explosion = 2,
  VendingMachine = 3,
  CH47 = 4,
  CargoShip = 5,
  Crate = 6,
  GenericRadius = 7,
  PatrolHelicopter = 8,
  TravelingVendor = 9
}

/** Broadcast event tipleri */
export interface BroadcastEvents {
  teamChanged: (data: { playerId: string; teamInfo: any }) => void;
  teamMessage: (data: { steamId: string; name: string; message: string; color: string; time: number }) => void;
  entityChanged: (data: { entityId: number; payload: any }) => void;
  clanChanged: (data: { clanInfo: any }) => void;
  clanMessage: (data: { clanId: number; message: any }) => void;
}

/** RustClient event tipleri */
export interface RustClientEvents extends BroadcastEvents {
  connecting: () => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: () => void;
  error: (error: Error) => void;
  request: (request: any) => void;
  response: (response: any) => void;
}
