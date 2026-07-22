/**
 * @fileoverview Örnek 10: Dinamik Sunucu Değiştirme (Switch Server)
 * 
 * Bu örnekte, aktif olan bir bağlantının nasıl kesileceğini,
 * tek bir metotla (`switchServer`) rate limit durumunu sıfırlayarak
 * farklı bir sunucuya nasıl dinamik olarak geçiş yapılacağını göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/10-switch-server.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const server1Ip = process.env.RUST_SERVER_IP || '127.0.0.1';
const server1Port = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

// Geçiş yapılmak istenen ikinci sunucu bilgileri (demo olarak yerel ağ simülasyonu)
const server2Ip = process.env.RUST_SERVER_2_IP || '127.0.0.2';
const server2Port = parseInt(process.env.RUST_SERVER_2_PORT || '28082');
const server2Token = parseInt(process.env.RUST_PLAYER_TOKEN_2 || '987654321');

async function run() {
  console.log('🔄 İlk sunucu bağlantısı hazırlanıyor...');
  const client = new RustClient({
    serverIp: server1Ip,
    serverPort: server1Port,
    steamId,
    playerToken,
  });

  client.on('connecting', () => console.log('⏳ Sunucuya bağlanılıyor...'));
  client.on('connected', () => console.log('🟢 Sunucuya bağlandı!'));
  client.on('disconnected', () => console.log('🔴 Bağlantı kapatıldı.'));

  try {
    // 1. Sunucuya bağlan
    await client.connect();
    console.log(`ℹ️ Sunucu 1 bağlandı: ${server1Ip}:${server1Port}`);
    
    console.log('⏳ 3 saniye bekleniyor...');
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 2. Dinamik olarak ikinci sunucuya geçiş yap
    console.log(`\n🔀 İkinci sunucuya geçiş yapılıyor: ${server2Ip}:${server2Port}...`);
    await client.switchServer({
      serverIp: server2Ip,
      serverPort: server2Port,
      steamId,
      playerToken: server2Token,
    });

    console.log(`ℹ️ Sunucu 2 bağlandı: ${server2Ip}:${server2Port}`);

  } catch (error: any) {
    console.error('❌ Geçiş sırasında hata:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
