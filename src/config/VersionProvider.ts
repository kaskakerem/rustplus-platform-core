/**
 * @fileoverview Facepunch sürüm sağlayıcısı.
 * Rust+ Companion API'sinden güncel sürüm bilgisini çeker.
 * Bağlantı URL'sine eklenen ?v= parametresini yönetir.
 * 
 * Facepunch bu değeri değiştirdiğinde sadece bu sınıf güncellenir.
 */

import { Config } from './Config';

/**
 * Facepunch Companion API sürüm yanıt formatı.
 */
interface VersionApiResponse {
  minPublishedTime?: number;
  [key: string]: any;
}

/**
 * Facepunch Rust+ Companion sürüm bilgisini yöneten sınıf.
 * ?v= URL parametresi için gerekli değeri sağlar.
 */
export class VersionProvider {
  private config: Config;
  private cachedVersion: string | null = null;
  private lastFetchTime: number = 0;
  /** Önbelleğin geçerlilik süresi (ms) — varsayılan 1 saat */
  private cacheTtlMs: number;

  /**
   * @param config SDK yapılandırma nesnesi
   * @param cacheTtlMs Önbellek geçerlilik süresi (ms), varsayılan: 3600000 (1 saat)
   */
  constructor(config: Config, cacheTtlMs: number = 3600000) {
    this.config = config;
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Facepunch API'sinden güncel sürüm değerini çeker.
   * Önbellek geçerliyse API'ye istek atmaz.
   * 
   * @returns Sürüm değeri (string olarak minPublishedTime + 1)
   */
  public async getVersion(): Promise<string> {
    // Önbellek geçerliyse kullan
    if (this.cachedVersion && (Date.now() - this.lastFetchTime) < this.cacheTtlMs) {
      return this.cachedVersion;
    }

    try {
      // Node.js 18+ native fetch kullan
      const response = await fetch(this.config.versionApiUrl);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = (await response.json()) as VersionApiResponse;
      
      if (data.minPublishedTime && typeof data.minPublishedTime === 'number') {
        this.cachedVersion = String(data.minPublishedTime + 1);
      } else {
        this.cachedVersion = this.config.defaultVersionValue;
      }
    } catch (error) {
      // API erişilemezse varsayılan değeri kullan
      this.cachedVersion = this.config.defaultVersionValue;
    }

    this.lastFetchTime = Date.now();
    return this.cachedVersion;
  }

  /**
   * Önbelleği temizler. Bir sonraki çağrıda API'ye yeni istek atar.
   */
  public clearCache(): void {
    this.cachedVersion = null;
    this.lastFetchTime = 0;
  }

  /**
   * Sürüm değerini manuel olarak ayarlar.
   * Test veya özel senaryolar için kullanılır.
   * @param version Kullanılacak sürüm değeri
   */
  public setVersion(version: string): void {
    this.cachedVersion = version;
    this.lastFetchTime = Date.now();
  }
}
