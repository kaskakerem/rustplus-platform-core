/**
 * @fileoverview SDK yapılandırma yönetimi.
 * Facepunch proxy URL'leri, sürüm bilgisi gibi değişebilir
 * değerleri tek bir noktadan yönetir.
 * 
 * Facepunch sürüm veya URL değiştirdiğinde sadece bu katman güncellenir.
 */

import { RateLimiterOptions } from '../types';

/** SDK iç yapılandırma değerleri */
export interface SdkConfig {
  /** WebSocket bağlantı URL şablonu (doğrudan bağlantı) */
  directUrlTemplate: string;
  /** WebSocket bağlantı URL şablonu (Facepunch proxy) */
  proxyUrlTemplate: string;
  /** Facepunch sürüm API URL'si */
  versionApiUrl: string;
  /** Sürüm alınamazsa kullanılacak varsayılan değer */
  defaultVersionValue: string;
  /** Yeniden bağlanma varsayılan aralığı (ms) */
  defaultReconnectInterval: number;
  /** Maksimum yeniden bağlanma aralığı (ms) */
  maxReconnectInterval: number;
  /** İstek varsayılan zaman aşımı (ms) */
  defaultRequestTimeout: number;
  /** Rate limiter varsayılan yapılandırması */
  defaultRateLimiter: Required<RateLimiterOptions>;
}

/** Varsayılan SDK yapılandırması */
const DEFAULT_CONFIG: SdkConfig = {
  directUrlTemplate: 'ws://{ip}:{port}',
  proxyUrlTemplate: 'wss://companion-rust.facepunch.com/game/{ip}/{port}',
  versionApiUrl: 'https://companion-rust.facepunch.com/api/version',
  defaultVersionValue: '9999999999999',
  defaultReconnectInterval: 5000,
  maxReconnectInterval: 30000,
  defaultRequestTimeout: 10000,
  defaultRateLimiter: {
    maxTokens: 25,
    tokensPerSecond: 3,
  },
};

/**
 * SDK yapılandırma sınıfı.
 * Facepunch URL'leri, sürüm bilgisi gibi zamanla değişebilecek
 * değerleri merkezi olarak yönetir.
 */
export class Config {
  private config: SdkConfig;

  constructor(overrides?: Partial<SdkConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...overrides };
  }

  /**
   * WebSocket bağlantı URL'sini oluşturur.
   * @param ip Sunucu IP adresi
   * @param port Sunucu portu
   * @param useProxy Facepunch proxy kullanılsın mı?
   * @param version Sürüm parametresi (?v= değeri)
   */
  public buildWebSocketUrl(ip: string, port: number, useProxy: boolean, version?: string): string {
    const template = useProxy ? this.config.proxyUrlTemplate : this.config.directUrlTemplate;
    let url = template.replace('{ip}', ip).replace('{port}', String(port));
    if (version) {
      url += `?v=${version}`;
    }
    return url;
  }

  /** Facepunch sürüm API URL'sini döner. */
  public get versionApiUrl(): string {
    return this.config.versionApiUrl;
  }

  /** Sürüm alınamazsa kullanılacak varsayılan değeri döner. */
  public get defaultVersionValue(): string {
    return this.config.defaultVersionValue;
  }

  /** Varsayılan yeniden bağlanma aralığını döner. */
  public get defaultReconnectInterval(): number {
    return this.config.defaultReconnectInterval;
  }

  /** Maksimum yeniden bağlanma aralığını döner. */
  public get maxReconnectInterval(): number {
    return this.config.maxReconnectInterval;
  }

  /** Varsayılan istek zaman aşımını döner. */
  public get defaultRequestTimeout(): number {
    return this.config.defaultRequestTimeout;
  }

  /** Varsayılan rate limiter yapılandırmasını döner. */
  public get defaultRateLimiter(): Required<RateLimiterOptions> {
    return this.config.defaultRateLimiter;
  }

  /**
   * Yapılandırmayı çalışma zamanında günceller.
   * @param overrides Güncellenecek değerler
   */
  public update(overrides: Partial<SdkConfig>): void {
    this.config = { ...this.config, ...overrides };
  }
}
