import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'events';

// WebSocket.OPEN statik sabitlerini de içeren tam uyumlu MockWebSocket sınıfı
vi.mock('ws', () => {
  const { EventEmitter } = require('events');
  class MockWebSocket extends EventEmitter {
    public static OPEN = 1;
    public static CLOSED = 3;
    public url: string;
    public readyState: number = 1; // OPEN
    constructor(url: string) {
      super();
      this.url = url;
    }
    public close() {
      this.readyState = 3; // CLOSED
      this.emit('close');
    }
    public terminate() {
      this.readyState = 3; // CLOSED
      this.emit('close');
    }
    public send(data: any) {}
  }
  return { default: MockWebSocket };
});

import { Connection } from '../src/Connection';
import { Config } from '../src/config/Config';
import { VersionProvider } from '../src/config/VersionProvider';

describe('Connection', () => {
  let config: Config;
  let versionProvider: VersionProvider;
  let connection: Connection;

  const flushMicrotasks = async () => {
    for (let i = 0; i < 10; i++) {
      await Promise.resolve();
    }
  };

  beforeEach(() => {
    config = new Config();
    versionProvider = new VersionProvider(config);
    vi.spyOn(versionProvider, 'getVersion').mockResolvedValue('9999999999999');

    connection = new Connection(
      '127.0.0.1',
      28082,
      config,
      versionProvider,
      false,
      true,
      1000
    );
  });

  afterEach(() => {
    connection.disconnect();
    vi.restoreAllMocks();
  });

  it('connect çağrıldığında doğru URL ile WebSocket oluşturmalıdır', async () => {
    const connectPromise = connection.connect();
    
    await flushMicrotasks();
    
    const mockWs = (connection as any).ws;
    expect(mockWs).toBeDefined();
    mockWs.emit('open');

    await connectPromise;
    expect(connection.isConnected()).toBe(true);
  });

  it('disconnect çağrıldığında bağlantıyı kapatmalı ve durumu güncellemelidir', async () => {
    const connectPromise = connection.connect();
    await flushMicrotasks();
    
    const mockWs = (connection as any).ws;
    mockWs.emit('open');
    await connectPromise;

    connection.disconnect();
    expect(connection.isConnected()).toBe(false);
  });

  it('bağlantı koptuğunda reconnect tetiklenmeli ve exponential backoff uygulamalıdır', async () => {
    vi.useFakeTimers();

    // Testin asenkron 'error' event'i fırlatıldığında çökmesini engellemek için hata dinleyicisi ekle
    connection.on('error', () => {});

    const connectPromise = connection.connect();
    await flushMicrotasks();
    
    const mockWs = (connection as any).ws;
    mockWs.emit('open');
    await connectPromise;

    let reconnectAttempts: number[] = [];
    connection.on('reconnecting', (attempt) => {
      reconnectAttempts.push(attempt);
    });

    // 1. Bağlantı koptu
    mockWs.emit('close');
    expect(connection.isConnected()).toBe(false);

    // 1. Reconnect denemesini tetikle (1s delay)
    await vi.advanceTimersByTimeAsync(1000);
    await flushMicrotasks();
    
    expect(reconnectAttempts).toContain(1);

    // 2. Reconnect denemesi (mockWs2) open edilmeden kapatılır
    const mockWs2 = (connection as any).ws;
    expect(mockWs2).toBeDefined();
    mockWs2.emit('close');

    // connect() catch bloğundaki handleDisconnect'in asenkron çalışması için flusla
    await flushMicrotasks();

    // 2. Reconnect denemesi tetiklenir (delay 1s * 2^1 = 2s)
    await vi.advanceTimersByTimeAsync(2000);
    await flushMicrotasks();
    
    expect(reconnectAttempts).toContain(2);

    vi.useRealTimers();
  });
});
