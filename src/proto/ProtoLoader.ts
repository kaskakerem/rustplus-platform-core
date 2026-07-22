/**
 * @fileoverview Protobuf yükleyici ve encode/decode yardımcıları.
 * rustplus.proto şemasını yükleyip AppRequest ve AppMessage
 * mesajlarını ikili formata dönüştürür / çözer.
 */

import * as protobuf from 'protobufjs';
import * as path from 'path';

/**
 * Protobuf mesaj tiplerini yükleyen ve encode/decode işlemlerini yöneten sınıf.
 */
export class ProtoLoader {
  private root: protobuf.Root | null = null;
  private AppRequest: protobuf.Type | null = null;
  private AppMessage: protobuf.Type | null = null;
  private loaded: boolean = false;

  /**
   * rustplus.proto dosyasını yükler ve mesaj tiplerini hazırlar.
   * Bağlantı kurulmadan önce mutlaka çağrılmalıdır.
   */
  public async load(): Promise<void> {
    if (this.loaded) return;

    const protoPath = path.resolve(__dirname, 'rustplus.proto');
    this.root = await protobuf.load(protoPath);
    this.AppRequest = this.root.lookupType('rustplus.AppRequest');
    this.AppMessage = this.root.lookupType('rustplus.AppMessage');
    this.loaded = true;
  }

  /**
   * Proto'nun yüklenip yüklenmediğini kontrol eder.
   */
  public isLoaded(): boolean {
    return this.loaded;
  }

  /**
   * AppRequest protobuf mesajını ikili (binary) formata dönüştürür.
   * @param data AppRequest alan değerlerini içeren nesne
   * @returns Encode edilmiş Uint8Array
   * @throws Proto yüklenmediyse hata fırlatır
   */
  public encodeRequest(data: Record<string, any>): Uint8Array {
    if (!this.AppRequest) {
      throw new Error('ProtoLoader henüz yüklenmedi. Önce load() çağrın.');
    }

    const message = this.AppRequest.fromObject(data);
    
    // Doğrulama
    const errMsg = this.AppRequest.verify(message);
    if (errMsg) {
      throw new Error(`Protobuf doğrulama hatası: ${errMsg}`);
    }

    return this.AppRequest.encode(message).finish();
  }

  /**
   * AppMessage (sunucu yanıtı veya broadcast) protobuf mesajını ikili formata dönüştürür.
   * Testlerde sunucu paketlerini simüle etmek için kullanılır.
   * @param data AppMessage alan değerlerini içeren nesne
   * @returns Encode edilmiş Uint8Array
   */
  public encodeMessage(data: Record<string, any>): Uint8Array {
    if (!this.AppMessage) {
      throw new Error('ProtoLoader henüz yüklenmedi. Önce load() çağrın.');
    }

    const message = this.AppMessage.fromObject(data);
    const errMsg = this.AppMessage.verify(message);
    if (errMsg) {
      throw new Error(`Protobuf doğrulama hatası: ${errMsg}`);
    }

    return this.AppMessage.encode(message).finish();
  }

  /**
   * Sunucudan gelen ikili veriyi AppMessage olarak çözümler.
   * @param buffer Sunucudan gelen binary veri
   * @returns Çözümlenmiş AppMessage nesnesi
   * @throws Proto yüklenmediyse veya decode başarısız olursa hata fırlatır
   */
  public decodeMessage(buffer: Uint8Array | Buffer): any {
    if (!this.AppMessage) {
      throw new Error('ProtoLoader henüz yüklenmedi. Önce load() çağrın.');
    }

    const message = this.AppMessage.decode(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);
    return this.AppMessage.toObject(message, {
      longs: String,
      enums: String,
      bytes: Buffer,
      defaults: true,
    });
  }

  /**
   * Ham (raw) decode - toObject dönüşümü yapmadan doğrudan protobuf mesajı döner.
   * Özel senaryolar için kullanılır.
   * @param buffer Sunucudan gelen binary veri
   * @returns Ham protobuf mesaj nesnesi
   */
  public decodeMessageRaw(buffer: Uint8Array | Buffer): protobuf.Message {
    if (!this.AppMessage) {
      throw new Error('ProtoLoader henüz yüklenmedi. Önce load() çağrın.');
    }
    return this.AppMessage.decode(buffer instanceof Buffer ? new Uint8Array(buffer) : buffer);
  }
}
