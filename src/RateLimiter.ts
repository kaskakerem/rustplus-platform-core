/**
 * @fileoverview Token Bucket tabanlı rate limiter.
 * Rust+ sunucusunun hız sınırına (rate limit) uygun olarak
 * istekleri kısarak sunucudan ban yemeyi önler.
 */

import { RateLimiterOptions } from './types';

/**
 * Token Bucket algoritması ile çalışan rate limiter.
 * 
 * Rust+ sunucuları belirli bir sürede belirli sayıda isteğe izin verir.
 * Bu sınıf, istekler gönderilmeden önce yeterli token olup olmadığını kontrol eder
 * ve gerekirse bekler.
 * 
 * @example
 * ```typescript
 * const limiter = new RateLimiter({ maxTokens: 25, tokensPerSecond: 3 });
 * await limiter.waitForTokens(1); // 1 token maliyetli istek için bekle
 * await limiter.waitForTokens(5); // 5 token maliyetli istek için bekle (getMap)
 * ```
 */
export class RateLimiter {
  /** Mevcut kullanılabilir token sayısı */
  private tokens: number;
  /** Maksimum token kapasitesi */
  private maxTokens: number;
  /** Saniyede yenilenen token sayısı */
  private tokensPerSecond: number;
  /** Token yenileme zamanlaması referansı */
  private replenishInterval: NodeJS.Timeout | null = null;
  /** Son token yenileme zaman damgası */
  private lastReplenishTime: number;

  /**
   * @param options Rate limiter yapılandırması
   */
  constructor(options?: RateLimiterOptions) {
    this.maxTokens = options?.maxTokens ?? 25;
    this.tokensPerSecond = options?.tokensPerSecond ?? 3;
    this.tokens = this.maxTokens;
    this.lastReplenishTime = Date.now();
  }

  /**
   * Token yenileme zamanlayıcısını başlatır.
   * RustClient bağlandığında çağrılır.
   */
  public start(): void {
    if (this.replenishInterval) return;
    
    this.tokens = this.maxTokens;
    this.lastReplenishTime = Date.now();
    
    this.replenishInterval = setInterval(() => {
      this.replenish();
    }, 1000);
  }

  /**
   * Token yenileme zamanlayıcısını durdurur.
   * RustClient bağlantıyı kestiğinde çağrılır.
   */
  public stop(): void {
    if (this.replenishInterval) {
      clearInterval(this.replenishInterval);
      this.replenishInterval = null;
    }
  }

  /**
   * Token yenileme işlemi.
   * Her saniye çağrılır ve yapılandırılmış miktarda token ekler.
   */
  private replenish(): void {
    this.tokens = Math.min(this.maxTokens, this.tokens + this.tokensPerSecond);
    this.lastReplenishTime = Date.now();
  }

  /**
   * Belirtilen maliyette token kullanılabilir olana kadar bekler.
   * Eğer token yeterliyse hemen tüketir ve döner.
   * Yetersizse, yeterli token olana kadar asenkron bekler.
   * 
   * @param cost Gerekli token sayısı
   * @param timeoutMs Maksimum bekleme süresi (ms), varsayılan: 30000
   * @returns Token alındıysa true, zaman aşımına uğradıysa false
   */
  public async waitForTokens(cost: number, timeoutMs: number = 30000): Promise<boolean> {
    const startTime = Date.now();

    while (this.tokens < cost) {
      if (Date.now() - startTime >= timeoutMs) {
        return false;
      }
      // Bir sonraki yenilemeye kadar bekle (333ms kontrol aralığı)
      await new Promise(resolve => setTimeout(resolve, 333));
    }

    this.tokens -= cost;
    return true;
  }

  /**
   * Anlık olarak yeterli token olup olmadığını kontrol eder (beklemeden).
   * @param cost Gerekli token sayısı
   * @returns Token yeterliyse true
   */
  public canConsume(cost: number): boolean {
    return this.tokens >= cost;
  }

  /**
   * Token tüketir (beklemeden). Yetersizse hata fırlatır.
   * @param cost Tüketilecek token sayısı
   * @throws Yetersiz token hatası
   */
  public consume(cost: number): void {
    if (this.tokens < cost) {
      throw new Error(`Yetersiz token: ${this.tokens} mevcut, ${cost} gerekli`);
    }
    this.tokens -= cost;
  }

  /**
   * Mevcut token sayısını döner.
   */
  public getAvailableTokens(): number {
    return this.tokens;
  }

  /**
   * Tokenları maksimuma sıfırlar.
   */
  public reset(): void {
    this.tokens = this.maxTokens;
  }
}
