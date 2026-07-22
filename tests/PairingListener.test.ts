import { describe, expect, it, vi } from 'vitest';
import { PairingListener } from '../src/pairing/PairingListener';

const notify = (listener: PairingListener, channelId: string, body: object): void => {
  (listener as any).handleNotification({
    appData: [
      { key: 'channelId', value: channelId },
      { key: 'title', value: 'Test title' },
      { key: 'message', value: 'Test message' },
      { key: 'body', value: JSON.stringify(body) },
    ],
  });
};

describe('PairingListener', () => {
  const createListener = () => new PairingListener({ androidId: 'android', securityToken: 'token' });

  it('sunucu pairing bildirimini normalize etmelidir', () => {
    const listener = createListener();
    const paired = vi.fn();
    listener.on('serverPaired', paired);

    notify(listener, 'pairing', {
      type: 'server',
      ip: '127.0.0.1',
      port: '28082',
      name: 'Test Server',
      playerId: '76561198000000000',
      playerToken: '123456',
      id: 'server-1',
    });

    expect(paired).toHaveBeenCalledWith(expect.objectContaining({
      ip: '127.0.0.1',
      port: 28082,
      steamId: '76561198000000000',
      playerToken: 123456,
    }));
  });

  it('entity pairing bildiriminde cihaz türünü belirlemelidir', () => {
    const listener = createListener();
    const paired = vi.fn();
    listener.on('entityPaired', paired);

    notify(listener, 'pairing', {
      type: 'entity',
      ip: '127.0.0.1',
      port: '28082',
      entityId: '42',
      entityName: 'Smart Switch',
      name: 'Base switch',
    });

    expect(paired).toHaveBeenCalledWith(expect.objectContaining({
      entityId: 42,
      type: 'switch',
      customName: 'Base switch',
    }));
  });

  it('alarm bildirimini başlık, mesaj ve gövdesiyle yayınlamalıdır', () => {
    const listener = createListener();
    const alarm = vi.fn();
    listener.on('alarm', alarm);

    notify(listener, 'alarm', { entityId: 99 });

    expect(alarm).toHaveBeenCalledWith({
      title: 'Test title',
      message: 'Test message',
      body: { entityId: 99 },
    });
  });

  it('bozuk JSON bildiriminde error eventi yayınlamalıdır', () => {
    const listener = createListener();
    const error = vi.fn();
    listener.on('error', error);

    (listener as any).handleNotification({
      appData: [
        { key: 'channelId', value: 'pairing' },
        { key: 'body', value: '{invalid-json' },
      ],
    });

    expect(error).toHaveBeenCalledOnce();
    expect(error.mock.calls[0][0]).toBeInstanceOf(Error);
  });
});
