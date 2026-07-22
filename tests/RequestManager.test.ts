import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { RequestManager } from '../src/RequestManager';
import { ProtoLoader } from '../src/proto/ProtoLoader';
import { Connection } from '../src/Connection';
import { RateLimiter } from '../src/RateLimiter';

describe('RequestManager', () => {
  let protoLoader: ProtoLoader;
  let connection: Connection;
  let rateLimiter: RateLimiter;
  let requestManager: RequestManager;

  // Asenkron microtask kuyruğunu (waitForTokens adımları) tamamen fluslayan kararlı yardımcı metot
  const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  beforeEach(async () => {
    vi.useFakeTimers();

    protoLoader = new ProtoLoader();
    await protoLoader.load();

    connection = {
      on: vi.fn(),
      send: vi.fn(),
    } as any;

    rateLimiter = {
      waitForTokens: vi.fn().mockResolvedValue(true),
      start: vi.fn(),
      stop: vi.fn(),
    } as any;

    requestManager = new RequestManager(
      protoLoader,
      connection,
      rateLimiter,
      '76561198000000000',
      123456789,
      10000 // 10s default timeout
    );
  });

  afterEach(() => {
    if (requestManager) {
      requestManager.cancelAllPending();
    }
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('gönderilen istek doğru bir seq numarası almalı ve callback listesine eklenmelidir', async () => {
    const promise = requestManager.sendRequest({ getInfo: {} }, 'getInfo');
    
    // microtask flusla
    await flushMicrotasks();

    expect(connection.send).toHaveBeenCalled();
    expect(requestManager.getPendingCount()).toBe(1);

    const mockResponse = {
      response: {
        seq: 1,
        info: { name: 'Rust Sunucusu', players: 10 }
      }
    };
    
    const encodedResponse = protoLoader.encodeMessage(mockResponse as any);
    const messageHandler = vi.mocked(connection.on).mock.calls.find(c => c[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    messageHandler(Buffer.from(encodedResponse));

    const result = await promise;
    expect(result.info.name).toBe('Rust Sunucusu');
    expect(requestManager.getPendingCount()).toBe(0);
  });

  it('belirlenen timeout süresinde yanıt gelmezse Promise reject olmalıdır', async () => {
    const promise = requestManager.sendRequest({ getInfo: {} }, 'getInfo', 5000); // 5s timeout
    promise.catch(() => {});

    await flushMicrotasks();

    // Zamanı 5.1 saniye ileri alalım
    await vi.advanceTimersByTimeAsync(5100);

    await expect(promise).rejects.toThrow('İstek zaman aşımı');
    expect(requestManager.getPendingCount()).toBe(0);
  });

  it('cancelAllPending çağrıldığında bekleyen tüm Promise’lar reject edilmelidir', async () => {
    const promise1 = requestManager.sendRequest({ getInfo: {} }, 'getInfo');
    const promise2 = requestManager.sendRequest({ getTime: {} }, 'getTime');
    promise1.catch(() => {});
    promise2.catch(() => {});

    await flushMicrotasks();

    expect(requestManager.getPendingCount()).toBe(2);

    requestManager.cancelAllPending();

    await expect(promise1).rejects.toThrow('Bağlantı kapatıldı');
    await expect(promise2).rejects.toThrow('Bağlantı kapatıldı');
    expect(requestManager.getPendingCount()).toBe(0);
  });

  it('mükerrer seq id ile gelen yanıtlar hata fırlatmamalı, sadece bekleyen isteği çözmelidir', async () => {
    const promise = requestManager.sendRequest({ getInfo: {} }, 'getInfo');
    promise.catch(() => {});

    await flushMicrotasks();

    const mockResponse = {
      response: {
        seq: 1,
        info: { name: 'Rust Sunucusu' }
      }
    };
    const encoded = Buffer.from(protoLoader.encodeMessage(mockResponse as any));
    const messageHandler = vi.mocked(connection.on).mock.calls.find(c => c[0] === 'message')?.[1];

    messageHandler(encoded);
    const result = await promise;
    expect(result.info.name).toBe('Rust Sunucusu');

    expect(() => messageHandler(encoded)).not.toThrow();
  });

  it('aynı anda 100 eşzamanlı istek gönderilebilmeli ve sırayla çözümlenmelidir', async () => {
    const promises: Promise<any>[] = [];

    for (let i = 1; i <= 100; i++) {
      const p = requestManager.sendRequest({ getInfo: {} }, 'getInfo');
      p.catch(() => {});
      promises.push(p);
    }

    await flushMicrotasks();

    expect(requestManager.getPendingCount()).toBe(100);

    const messageHandler = vi.mocked(connection.on).mock.calls.find(c => c[0] === 'message')?.[1];
    expect(messageHandler).toBeDefined();

    for (let i = 1; i <= 100; i++) {
      const mockResp = {
        response: {
          seq: i,
          info: { name: `Sunucu-${i}` }
        }
      };
      messageHandler(Buffer.from(protoLoader.encodeMessage(mockResp as any)));
    }

    const results = await Promise.all(promises);
    expect(results.length).toBe(100);
    expect(results[0].info.name).toBe('Sunucu-1');
    expect(results[99].info.name).toBe('Sunucu-100');
    expect(requestManager.getPendingCount()).toBe(0);
  });

  it('yüksek ping / gecikmeli ortamlarda (1000ms) istekler doğru çözümlenmelidir', async () => {
    const promise = requestManager.sendRequest({ getInfo: {} }, 'getInfo', 5000);
    promise.catch(() => {});

    await flushMicrotasks();

    // 1000ms ağ gecikmesini simüle et
    await vi.advanceTimersByTimeAsync(1000);

    const mockResp = {
      response: {
        seq: 1,
        info: { name: 'Gecikmeli Sunucu' }
      }
    };
    const messageHandler = vi.mocked(connection.on).mock.calls.find(c => c[0] === 'message')?.[1];
    messageHandler(Buffer.from(protoLoader.encodeMessage(mockResp as any)));

    const result = await promise;
    expect(result.info.name).toBe('Gecikmeli Sunucu');
  });

  it('paket kaybı simülasyonunda (%30) kaybolan istekler timeout olmalı, gelenler çözülmelidir', async () => {
    const promises: Promise<any>[] = [];

    for (let i = 1; i <= 10; i++) {
      const promise = requestManager.sendRequest({ getInfo: {} }, 'getInfo', 3000);
      promise.catch(() => {});
      promises.push(promise);
    }

    await flushMicrotasks();

    expect(requestManager.getPendingCount()).toBe(10);

    const messageHandler = vi.mocked(connection.on).mock.calls.find(c => c[0] === 'message')?.[1];

    const lostSeqs = [1, 4, 7];

    for (let i = 1; i <= 10; i++) {
      if (lostSeqs.includes(i)) continue;

      const mockResp = {
        response: {
          seq: i,
          info: { name: `Paket-${i}` }
        }
      };
      messageHandler(Buffer.from(protoLoader.encodeMessage(mockResp as any)));
    }

    // 3 saniye timeout süresini geç
    await vi.advanceTimersByTimeAsync(3100);

    const results = await Promise.allSettled(promises);
    
    expect(results[0].status).toBe('rejected'); // seq 1: kayıp
    expect(results[1].status).toBe('fulfilled'); // seq 2: ulaştı
    expect(results[3].status).toBe('rejected'); // seq 4: kayıp
    expect(results[5].status).toBe('fulfilled'); // seq 6: ulaştı
  });
});
