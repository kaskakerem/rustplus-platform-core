import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'events';
import { EventManager } from '../src/events/EventManager';
import { ProtoLoader } from '../src/proto/ProtoLoader';

describe('EventManager', () => {
  let emitter: EventEmitter;
  let protoLoader: ProtoLoader;
  let eventManager: EventManager;

  beforeEach(async () => {
    protoLoader = new ProtoLoader();
    await protoLoader.load();
    emitter = new EventEmitter();
    eventManager = new EventManager(emitter, protoLoader);
  });

  it('teamChanged broadcast paketi geldiğinde client üzerinde doğru eventi tetiklemelidir', () => {
    let triggeredData: any = null;
    emitter.on('teamChanged', (data) => {
      triggeredData = data;
    });

    const mockBroadcast = {
      broadcast: {
        teamChanged: {
          playerId: '76561198000000000',
          teamInfo: {
            leaderSteamId: '76561198000000000',
            members: [{ name: 'Oyuncu1', steamId: '76561198000000000' }]
          }
        }
      }
    };

    const encoded = protoLoader.encodeMessage(mockBroadcast as any);
    eventManager.handleMessage(Buffer.from(encoded));

    expect(triggeredData).toBeDefined();
    expect(triggeredData.playerId).toBe('76561198000000000');
    expect(triggeredData.teamInfo.leaderSteamId).toBe('76561198000000000');
    expect(triggeredData.teamInfo.members[0].name).toBe('Oyuncu1');
  });

  it('entityChanged broadcast paketi geldiğinde client üzerinde doğru eventi tetiklemelidir', () => {
    let triggeredData: any = null;
    emitter.on('entityChanged', (data) => {
      triggeredData = data;
    });

    const mockBroadcast = {
      broadcast: {
        entityChanged: {
          entityId: 12345,
          payload: {
            value: true,
            capacity: 10
          }
        }
      }
    };

    const encoded = protoLoader.encodeMessage(mockBroadcast as any);
    eventManager.handleMessage(Buffer.from(encoded));

    expect(triggeredData).toBeDefined();
    expect(triggeredData.entityId).toBe(12345);
    expect(triggeredData.payload.value).toBe(true);
    expect(triggeredData.payload.capacity).toBe(10);
  });

  it('teamMessage broadcast paketi geldiğinde client üzerinde doğru eventi tetiklemelidir', () => {
    let triggeredData: any = null;
    emitter.on('teamMessage', (data) => {
      triggeredData = data;
    });

    const mockBroadcast = {
      broadcast: {
        teamMessage: {
          message: {
            steamId: '76561198000000000',
            name: 'Kerem',
            message: 'Selam takım!',
            color: '#ffffff',
            time: 1620000000
          }
        }
      }
    };

    const encoded = protoLoader.encodeMessage(mockBroadcast as any);
    eventManager.handleMessage(Buffer.from(encoded));

    expect(triggeredData).toBeDefined();
    expect(triggeredData.name).toBe('Kerem');
    expect(triggeredData.message).toBe('Selam takım!');
  });

  it('clanChanged ve clanMessage paketlerini doğru eventlere yönlendirmelidir', () => {
    const clanChanged = vi.fn();
    const clanMessage = vi.fn();
    emitter.on('clanChanged', clanChanged);
    emitter.on('clanMessage', clanMessage);

    const encodedChanged = protoLoader.encodeMessage({
      broadcast: {
        clanChanged: {
          clanInfo: { clanId: '123', name: 'Test Clan', motd: 'Welcome' },
        },
      },
    });
    const encodedMessage = protoLoader.encodeMessage({
      broadcast: {
        clanMessage: {
          clanId: '123',
          message: { steamId: '456', name: 'Kerem', message: 'Selam', time: '1000' },
        },
      },
    });

    eventManager.handleMessage(Buffer.from(encodedChanged));
    eventManager.handleMessage(Buffer.from(encodedMessage));

    expect(clanChanged).toHaveBeenCalledWith(expect.objectContaining({
      clanInfo: expect.objectContaining({ name: 'Test Clan' }),
    }));
    expect(clanMessage).toHaveBeenCalledWith(expect.objectContaining({
      clanId: '123',
      message: expect.objectContaining({ message: 'Selam' }),
    }));
  });

  it('cameraRays paketini Buffer ve entity verileriyle yayınlamalıdır', () => {
    const cameraRays = vi.fn();
    emitter.on('cameraRays', cameraRays);

    const encoded = protoLoader.encodeMessage({
      broadcast: {
        cameraRays: {
          verticalFov: 60,
          sampleOffset: 2,
          rayData: Buffer.from([1, 2, 3]),
          distance: 100,
          timeOfDay: 12,
          entities: [{
            entityId: 7,
            type: 'Player',
            position: { x: 1, y: 2, z: 3 },
            rotation: { x: 0, y: 0, z: 0 },
            size: { x: 1, y: 2, z: 1 },
            name: 'Player',
          }],
        },
      },
    });

    eventManager.handleMessage(Buffer.from(encoded));

    expect(cameraRays).toHaveBeenCalledWith(expect.objectContaining({
      rayData: new Uint8Array([1, 2, 3]),
      entities: [expect.objectContaining({ entityId: 7, type: 'Player' })],
    }));
  });

  it('geçersiz protobuf verisi geldiğinde hata fırlatmak yerine error eventi fırlatmalı ve uygulamayı çökertmemelidir', () => {
    let errorTriggered = false;
    emitter.on('error', () => {
      errorTriggered = true;
    });

    // Bozuk binary veri
    const corruptData = Buffer.from([0xFF, 0xFF, 0xFF, 0xFF]);

    expect(() => {
      eventManager.handleMessage(corruptData);
    }).not.toThrow();

    expect(errorTriggered).toBe(true);
  });
});
