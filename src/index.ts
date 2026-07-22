/**
 * @fileoverview Rust+ Platform SDK — Ana Export Dosyası.
 * 
 * Bu modül, Rust+ oyun sunucuları ile etkileşim kurmak için
 * gerekli tüm sınıfları, tipleri ve sabitleri dışa aktarır.
 * 
 * @packageDocumentation
 * @module @rustplus-platform/core
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
 * const info = await client.getInfo();
 * console.log(info.name);
 * ```
 */

// Ana istemci sınıfı
export { RustClient } from './RustClient';

// Bağlantı yönetimi
export { Connection } from './Connection';
export type { ConnectionEvents } from './Connection';

// İstek-yanıt yöneticisi
export { RequestManager } from './RequestManager';

// Rate limiter
export { RateLimiter } from './RateLimiter';

// Protobuf yükleyici
export { ProtoLoader } from './proto/ProtoLoader';

// Yapılandırma
export { Config } from './config/Config';
export type { SdkConfig } from './config/Config';
export { VersionProvider } from './config/VersionProvider';

// Event yöneticisi
export { EventManager } from './events/EventManager';

// FCM Pairing (eşleştirme)
export { PairingListener } from './pairing/PairingListener';
export type {
  FcmCredentials,
  ServerPairingData,
  EntityPairingData,
  PairingListenerEvents,
} from './pairing/PairingListener';

// Tip tanımları ve sabitler
export {
  ConnectionState,
  EntityType,
  MarkerType,
  TOKEN_COSTS,
} from './types';

export type * from './types';
