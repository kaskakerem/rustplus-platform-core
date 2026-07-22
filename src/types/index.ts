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

/** Protobuf decode sonucunda enumlar isim olarak döner. */
export type EntityTypeName = 'UnknownType' | 'Switch' | 'Alarm' | 'StorageMonitor';
export type MarkerTypeName =
  | 'Undefined'
  | 'Player'
  | 'Explosion'
  | 'VendingMachine'
  | 'CH47'
  | 'CargoShip'
  | 'Crate'
  | 'GenericRadius'
  | 'PatrolHelicopter'
  | 'TravelingVendor';

export interface Vector2 {
  x: number;
  y: number;
}

export interface Vector3 extends Vector2 {
  z: number;
}

export interface Vector4 extends Vector3 {
  w: number;
}

export interface ServerInfo {
  name: string;
  headerImage: string;
  url: string;
  map: string;
  mapSize: number;
  wipeTime: number;
  players: number;
  maxPlayers: number;
  queuedPlayers: number;
  seed: number;
  salt: number;
  logoImage: string;
  nexus: string;
  nexusId: number;
  nexusZone: string;
  camerasEnabled: boolean;
}

export interface GameTime {
  dayLengthMinutes: number;
  timeScale: number;
  sunrise: number;
  sunset: number;
  time: number;
}

export interface MapMonument {
  token: string;
  x: number;
  y: number;
}

export interface MapData {
  width: number;
  height: number;
  jpgImage: Buffer;
  oceanMargin: number;
  monuments: MapMonument[];
  background: string;
}

export interface EntityItem {
  itemId: number;
  quantity: number;
  itemIsBlueprint: boolean;
}

export interface EntityPayload {
  value: boolean;
  items: EntityItem[];
  capacity: number;
  hasProtection: boolean;
  protectionExpiry: number;
}

export interface EntityInfo {
  type: EntityTypeName;
  payload: EntityPayload;
}

export interface TeamMember {
  steamId: string;
  name: string;
  x: number;
  y: number;
  isOnline: boolean;
  spawnTime: number;
  isAlive: boolean;
  deathTime: number;
}

export interface TeamMapNote {
  type: number;
  x: number;
  y: number;
  icon: number;
  colourIndex: number;
  label: string;
}

export interface TeamInfo {
  leaderSteamId: string;
  members: TeamMember[];
  mapNotes: TeamMapNote[];
  leaderMapNotes: TeamMapNote[];
}

export interface TeamMessage {
  steamId: string;
  name: string;
  message: string;
  color: string;
  time: number;
}

export interface TeamChat {
  messages: TeamMessage[];
}

export interface MarkerSellOrder {
  itemId: number;
  quantity: number;
  currencyId: number;
  costPerItem: number;
  amountInStock: number;
  itemIsBlueprint: boolean;
  currencyIsBlueprint: boolean;
  itemCondition: number;
  itemConditionMax: number;
}

export interface MapMarker {
  id: number;
  type: MarkerTypeName;
  x: number;
  y: number;
  steamId: string;
  rotation: number;
  radius: number;
  color1: Vector4 | null;
  color2: Vector4 | null;
  alpha: number;
  name: string;
  outOfStock: boolean;
  sellOrders: MarkerSellOrder[];
}

export interface MapMarkers {
  markers: MapMarker[];
}

export interface ClanRole {
  roleId: number;
  rank: number;
  name: string;
  canSetMotd: boolean;
  canSetLogo: boolean;
  canInvite: boolean;
  canKick: boolean;
  canPromote: boolean;
  canDemote: boolean;
  canSetPlayerNotes: boolean;
  canAccessLogs: boolean;
}

export interface ClanMember {
  steamId: string;
  roleId: number;
  joined: string;
  lastSeen: string;
  notes: string;
  online: boolean;
}

export interface ClanInvite {
  steamId: string;
  recruiter: string;
  timestamp: string;
}

export interface ClanInfo {
  clanId: string;
  name: string;
  created: string;
  creator: string;
  motd: string;
  motdTimestamp: string;
  motdAuthor: string;
  logo: Buffer;
  color: number;
  roles: ClanRole[];
  members: ClanMember[];
  invites: ClanInvite[];
  maxMemberCount: number;
}

export interface ClanInfoResponse {
  clanInfo: ClanInfo | null;
}

export interface ClanMessage {
  steamId: string;
  name: string;
  message: string;
  time: string;
}

export interface ClanChat {
  messages: ClanMessage[];
}

export interface CameraInfo {
  width: number;
  height: number;
  nearPlane: number;
  farPlane: number;
  controlFlags: number;
}

export type CameraEntityTypeName = 'UnknownType' | 'Tree' | 'Player';

export interface CameraEntity {
  entityId: number;
  type: CameraEntityTypeName;
  position: Vector3;
  rotation: Vector3;
  size: Vector3;
  name: string;
}

export interface CameraRays {
  verticalFov: number;
  sampleOffset: number;
  rayData: Buffer;
  distance: number;
  entities: CameraEntity[];
  timeOfDay: number;
}

export interface AppError {
  error: string;
}

export interface AppFlag {
  value: boolean;
}

export interface AppResponse {
  seq: number;
  success: Record<string, never> | null;
  error: AppError | null;
  info: ServerInfo | null;
  time: GameTime | null;
  map: MapData | null;
  teamInfo: TeamInfo | null;
  teamChat: TeamChat | null;
  entityInfo: EntityInfo | null;
  flag: AppFlag | null;
  mapMarkers: MapMarkers | null;
  clanInfo: ClanInfoResponse | null;
  clanChat: ClanChat | null;
  cameraSubscribeInfo: CameraInfo | null;
}

export interface AppBroadcast {
  teamChanged: { playerId: string; teamInfo: TeamInfo } | null;
  teamMessage: { message: TeamMessage } | null;
  entityChanged: { entityId: number; payload: EntityPayload } | null;
  clanChanged: { clanInfo: ClanInfo } | null;
  clanMessage: { clanId: string; message: ClanMessage } | null;
  cameraRays: CameraRays | null;
}

export interface AppMessage {
  response: AppResponse | null;
  broadcast: AppBroadcast | null;
}

/** Broadcast event tipleri */
export interface BroadcastEvents {
  teamChanged: (data: { playerId: string; teamInfo: TeamInfo }) => void;
  teamMessage: (data: TeamMessage) => void;
  entityChanged: (data: { entityId: number; payload: EntityPayload }) => void;
  clanChanged: (data: { clanInfo: ClanInfo }) => void;
  clanMessage: (data: { clanId: string; message: ClanMessage }) => void;
  cameraRays: (data: CameraRays) => void;
}

/** RustClient event tipleri */
export interface RustClientEvents extends BroadcastEvents {
  connecting: () => void;
  connected: () => void;
  disconnected: () => void;
  reconnecting: (attempt: number) => void;
  error: (error: Error) => void;
  request: (request: unknown) => void;
  response: (response: AppResponse) => void;
}
