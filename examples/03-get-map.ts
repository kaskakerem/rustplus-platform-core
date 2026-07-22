/**
 * @fileoverview Örnek 03: Sunucu Haritasını Kaydetme
 * 
 * Bu örnekte, sunucunun JPG harita verisini çekeceğiz
 * ve bunu yerel diske bir dosya olarak yazacağız.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/03-get-map.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverIp = process.env.RUST_SERVER_IP || '127.0.0.1';
const serverPort = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

async function run() {
  const client = new RustClient({ serverIp, serverPort, steamId, playerToken });

  try {
    await client.connect();

    console.log('⏳ Harita verisi sorgulanıyor (Bu işlem harita boyutuna göre sürebilir)...');
    // getMap maliyetli olduğu için 30 saniye timeout verdik
    const map = await client.getMap(30000);

    if (map && map.jpgImage) {
      const outputPath = path.resolve(__dirname, 'rust_map.jpg');
      
      // Binary veriyi (Buffer) dosyaya yaz
      fs.writeFileSync(outputPath, map.jpgImage);
      console.log(`🟢 Harita başarıyla kaydedildi: ${outputPath}`);
      console.log(`📐 Genişlik: ${map.width}px, Yükseklik: ${map.height}px`);
      console.log(`🗿 Sunucu üzerindeki anıt sayısı: ${map.monuments.length}`);
    } else {
      console.warn('⚠️ Harita verisi alınamadı veya sunucu harita göndermeyi kapatmış.');
    }

  } catch (error: any) {
    console.error('❌ Harita alınamadı:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
