import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RateLimiter } from '../src/RateLimiter';

describe('RateLimiter', () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    vi.useFakeTimers();
    limiter = new RateLimiter({ maxTokens: 25, tokensPerSecond: 3 });
  });

  afterEach(() => {
    limiter.stop();
    vi.useRealTimers();
  });

  it('başlangıçta maksimum token sayısına sahip olmalıdır', () => {
    expect(limiter.getAvailableTokens()).toBe(25);
  });

  it('token tüketildiğinde kullanılabilir token sayısı azalmalıdır', () => {
    limiter.consume(5);
    expect(limiter.getAvailableTokens()).toBe(20);
  });

  it('yetersiz token olduğunda consume hata fırlatmalıdır', () => {
    expect(() => limiter.consume(26)).toThrow('Yetersiz token');
  });

  it('zamanlayıcı başlatıldığında tokenlar saniyede bir yenilenmelidir', async () => {
    limiter.start();
    
    limiter.consume(10); // 15 kaldı
    expect(limiter.getAvailableTokens()).toBe(15);
    
    // 1 saniye (1000ms) ileri al
    await vi.advanceTimersByTimeAsync(1000);
    expect(limiter.getAvailableTokens()).toBe(18);

    // 2 saniye daha ileri al
    await vi.advanceTimersByTimeAsync(2000);
    expect(limiter.getAvailableTokens()).toBe(24);

    // Maksimum kapasiteyi aşmamalı
    await vi.advanceTimersByTimeAsync(2000);
    expect(limiter.getAvailableTokens()).toBe(25);
  });

  it('waitForTokens token yeterli olduğunda hemen true dönmelidir', async () => {
    const success = await limiter.waitForTokens(5);
    expect(success).toBe(true);
    expect(limiter.getAvailableTokens()).toBe(20);
  });

  it('waitForTokens token yetersiz olduğunda beklemeli ve yenilenince true dönmelidir', async () => {
    limiter.consume(25); // 0 kaldı

    const pendingPromise = limiter.waitForTokens(3); // 3 token bekliyoruz
    
    // Loop'un bir kez çalışıp beklemesi için 333ms ilerlet
    await vi.advanceTimersByTimeAsync(333);
    
    // Manuel olarak 3 token ekle (böylece interval çakışmalarından arınır ve deterministik olur)
    (limiter as any).replenish();
    
    // Loop'un yeni tokenı fark edip resolve etmesi için bir 333ms daha ilerlet
    await vi.advanceTimersByTimeAsync(333);
    
    const success = await pendingPromise;
    expect(success).toBe(true);
    expect(limiter.getAvailableTokens()).toBe(0);
  });

  it('waitForTokens belirlenen timeout süresinde token yenilenmezse false dönmelidir', async () => {
    limiter.consume(25); // 0 kaldı
    
    // start() çağrılmadı, yani yenilenme gerçekleşmeyecek
    const pendingPromise = limiter.waitForTokens(1, 100); // 100ms timeout
    
    // waitForTokens içindeki setTimeout 333ms aralıklarla çalışır.
    // 100ms timeout kontrolünün tetiklenmesi için en az bir kez loop'un dönmesi gerekir.
    // Bu yüzden 400ms ilerletiyoruz.
    await vi.advanceTimersByTimeAsync(400);

    const success = await pendingPromise;
    expect(success).toBe(false);
  });
});
