/**
 * @fileoverview Örnek 01: Sunucu Bağlantısı
 * 
 * Bu örnekte, Rust sunucusuna nasıl güvenli bir WebSocket bağlantısı
 * kurulacağını ve bağlantının nasıl kapatılacağını göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/01-connect.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

// .env dosyasını yükle
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverIp = process.env.RUST_SERVER_IP || '127.0.0.1';
const serverPort = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

async function run() {
  console.log('🔄 İstemci yapılandırılıyor...');
  
  const client = new RustClient({
    serverIp,
    serverPort,
    steamId,
    playerToken,
    useFacepunchProxy: false, // Yerel / doğrudan bağlantı
    autoReconnect: true,
  });

  // Olayları dinle
  client.on('connecting', () => console.log('⏳ Sunucuya bağlanılıyor...'));
  client.on('connected', () => console.log('🟢 Sunucuya başarıyla bağlandı!'));
  client.on('disconnected', () => console.log('🔴 Sunucu bağlantısı koptu.'));
  client.on('error', (err) => console.error('❌ Hata oluştu:', err.message));

  try {
    // Sunucuya bağlan
    await client.connect();
    
    console.log('🎉 Bağlantı kanıtlandı! 5 saniye sonra kapatılıyor...');
    await new Promise((resolve) => setTimeout(resolve, 5000));
  } catch (error: any) {
    console.error('💥 Bağlantı başarısız:', error.message);
  } finally {
    // Temiz bir şekilde bağlantıyı kapat
    client.disconnect();
    console.log('🔌 Bağlantı kapatıldı.');
  }
}

run();
