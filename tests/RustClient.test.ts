import { beforeEach, describe, expect, it, vi } from 'vitest';
import { RustClient } from '../src/RustClient';

describe('RustClient public commands', () => {
  let client: RustClient;
  let sendRequest: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    client = new RustClient({
      serverIp: '127.0.0.1',
      serverPort: 28082,
      steamId: '76561198000000000',
      playerToken: 123456,
    });
    sendRequest = vi.fn();
    (client as any).requestManager = {
      sendRequest,
      cancelAllPending: vi.fn(),
    };
  });

  it('getInfo doğru komutu göndermeli ve yalnızca info alanını döndürmelidir', async () => {
    const info = { name: 'Test Server', players: 10 };
    sendRequest.mockResolvedValue({ info });

    await expect(client.getInfo()).resolves.toBe(info);
    expect(sendRequest).toHaveBeenCalledWith({ getInfo: {} }, 'getInfo', undefined);
  });

  it('getEntityInfo entityId değerini üst istek alanında göndermelidir', async () => {
    const entityInfo = { type: 'Switch', payload: { value: true } };
    sendRequest.mockResolvedValue({ entityInfo });

    await expect(client.getEntityInfo(42, 5000)).resolves.toBe(entityInfo);
    expect(sendRequest).toHaveBeenCalledWith(
      { entityId: 42, getEntityInfo: {} },
      'getEntityInfo',
      5000
    );
  });

  it('akıllı şalter kısa yolları doğru boolean değerlerini göndermelidir', async () => {
    sendRequest.mockResolvedValue({ success: {} });

    await client.turnSmartSwitchOn(10);
    await client.turnSmartSwitchOff(10);

    expect(sendRequest).toHaveBeenNthCalledWith(
      1,
      { entityId: 10, setEntityValue: { value: true } },
      'setEntityValue',
      undefined
    );
    expect(sendRequest).toHaveBeenNthCalledWith(
      2,
      { entityId: 10, setEntityValue: { value: false } },
      'setEntityValue',
      undefined
    );
  });

  it('kamera girdisini protobuf yapısına uygun göndermelidir', async () => {
    sendRequest.mockResolvedValue({ success: {} });

    await client.sendCameraInput(1, 12, -4, 2500);

    expect(sendRequest).toHaveBeenCalledWith(
      { cameraInput: { buttons: 1, mouseDelta: { x: 12, y: -4 } } },
      'cameraInput',
      2500
    );
  });

  it('switchServer eski bağlantıyı temizleyip yeni seçenekleri kurmalıdır', async () => {
    const oldConnection = (client as any).connection;
    const disconnect = vi.spyOn(client, 'disconnect');
    const removeAllListeners = vi.spyOn(oldConnection, 'removeAllListeners');
    const resetLimiter = vi.spyOn((client as any).rateLimiter, 'reset');
    const connect = vi.spyOn(client, 'connect').mockResolvedValue();

    await client.switchServer({
      serverIp: '10.0.0.2',
      serverPort: 28083,
      steamId: '76561198000000001',
      playerToken: 654321,
    });

    expect(disconnect).toHaveBeenCalledOnce();
    expect(removeAllListeners).toHaveBeenCalledOnce();
    expect(resetLimiter).toHaveBeenCalledOnce();
    expect(connect).toHaveBeenCalledOnce();
    expect((client as any).connection).not.toBe(oldConnection);
    expect((client as any).options.serverIp).toBe('10.0.0.2');
  });
});
