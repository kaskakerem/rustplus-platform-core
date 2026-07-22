/**
 * @fileoverview Broadcast event yöneticisi.
 * Rust+ sunucusundan gelen spontane mesajları (broadcast) dinler ve
 * uygun event handler'lara yönlendirir.
 * 
 * Broadcast türleri:
 * - teamChanged: Takım üyeleri değişti (giriş/çıkış, pozisyon)
 * - teamMessage: Takım sohbet mesajı
 * - entityChanged: Entity durumu değişti (switch açıldı/kapandı, alarm)
 * - clanChanged: Klan bilgisi değişti
 * - clanMessage: Klan sohbet mesajı
 */

import { EventEmitter } from 'events';
import { ProtoLoader } from '../proto/ProtoLoader';

/**
 * Sunucudan gelen broadcast mesajlarını işleyen ve
 * RustClient'a event olarak ileten yönetici sınıf.
 */
export class EventManager {
  private emitter: EventEmitter;
  private protoLoader: ProtoLoader;

  /**
   * @param emitter RustClient'ın EventEmitter'ı (olayları buraya yayar)
   * @param protoLoader Protobuf çözümleyici
   */
  constructor(emitter: EventEmitter, protoLoader: ProtoLoader) {
    this.emitter = emitter;
    this.protoLoader = protoLoader;
  }

  /**
   * Gelen ham mesajı çözümler ve broadcast türüne göre
   * uygun event'i tetikler.
   * 
   * Mesaj yapısı (AppMessage proto'sundan):
   * - response: İstek yanıtı (RequestManager tarafından işlenir)
   * - broadcast: Spontane sunucu mesajı (biz işliyoruz)
   * 
   * @param data Sunucudan gelen binary veri
   */
  public handleMessage(data: Buffer): void {
    try {
      const message = this.protoLoader.decodeMessage(data);

      // Sadece broadcast mesajları ile ilgileniyoruz
      if (!message.broadcast) return;

      const broadcast = message.broadcast;

      // Takım değişikliği (üye giriş/çıkış, pozisyon güncelleme)
      if (broadcast.teamChanged) {
        this.emitter.emit('teamChanged', {
          playerId: broadcast.teamChanged.playerId,
          teamInfo: broadcast.teamChanged.teamInfo,
        });
      }

      // Takım sohbet mesajı
      if (broadcast.teamMessage && broadcast.teamMessage.message) {
        const msg = broadcast.teamMessage.message;
        this.emitter.emit('teamMessage', {
          steamId: msg.steamId,
          name: msg.name,
          message: msg.message,
          color: msg.color,
          time: msg.time,
        });
      }

      // Entity durumu değişti (switch, alarm, storage monitor)
      if (broadcast.entityChanged) {
        this.emitter.emit('entityChanged', {
          entityId: broadcast.entityChanged.entityId,
          payload: broadcast.entityChanged.payload,
        });
      }

      // Klan bilgisi değişti
      if (broadcast.clanChanged) {
        this.emitter.emit('clanChanged', {
          clanInfo: broadcast.clanChanged.clanInfo,
        });
      }

      // Klan sohbet mesajı
      if (broadcast.clanMessage) {
        this.emitter.emit('clanMessage', {
          clanId: broadcast.clanMessage.clanId,
          message: broadcast.clanMessage.message,
        });
      }

      // Kamera ışın verisi (ileri sürümde desteklenecek)
      if (broadcast.cameraRays) {
        this.emitter.emit('cameraRays', broadcast.cameraRays);
      }

    } catch (error) {
      // Decode hatası — corrupt veya beklenmeyen mesaj
      this.emitter.emit('error', 
        error instanceof Error ? error : new Error(`Broadcast decode hatası: ${String(error)}`)
      );
    }
  }
}
