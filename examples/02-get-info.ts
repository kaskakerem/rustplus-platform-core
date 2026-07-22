/**
 * @fileoverview Örnek 02: Sunucu Bilgilerini Alma
 * 
 * Bu örnekte, Rust+ sunucusunun adını, aktif oyuncu sayısını,
 * harita boyutunu, seed ve salt değerlerini sorgulayacağız.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/02-get-info.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverIp = process.env.RUST_SERVER_IP || '127.0.0.1';
const serverPort = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

async function run() {
  const client = new RustClient({ serverIp, serverPort, steamId, playerToken });

  try {
    await client.connect();

    console.log('⏳ Sunucu bilgileri talep ediliyor...');
    const info = await client.getInfo();

    console.log('\n======================================');
    console.log(`🎮 Sunucu Adı:    ${info.name}`);
    console.log(`👥 Oyuncu Sayısı: ${info.players} / ${info.maxPlayers}`);
    console.log(`🗺️ Harita Sürümü: ${info.map}`);
    console.log(`📐 Harita Boyutu: ${info.mapSize} m`);
    console.log(`🌱 Harita Seed:   ${info.seed}`);
    console.log(`⏳ Wipe Zamanı:   ${new Date(info.wipeTime * 1000).toLocaleString()}`);
    console.log('======================================\n');

  } catch (error: any) {
    console.error('❌ İşlem başarısız:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
