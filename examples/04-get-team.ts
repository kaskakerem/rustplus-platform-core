/**
 * @fileoverview Örnek 04: Takım Bilgilerini Sorgulama
 * 
 * Bu örnekte, oyuncunun takım üyelerini, üyelerin hayatta olup
 * olmadığını, koordinatlarını ve haritadaki notları sorgulayacağız.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/04-get-team.ts
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

    console.log('⏳ Takım bilgileri sorgulanıyor...');
    const team = await client.getTeamInfo();

    console.log('\n=================== TAKIM BİLGİLERİ ===================');
    console.log(`👑 Lider Steam ID: ${team.leaderSteamId}`);
    console.log(`👥 Toplam Üye:    ${team.members.length}`);
    console.log('-------------------------------------------------------');

    team.members.forEach((member: any) => {
      const state = member.isOnline ? '🟢 Çevrimiçi' : '🔴 Çevrimdışı';
      const status = member.isAlive ? '❤️ Hayatta' : '💀 Ölü';
      console.log(`👤 ${member.name.padEnd(20)} | ${state} | ${status} | Konum: (${member.x.toFixed(1)}, ${member.y.toFixed(1)})`);
    });

    console.log('-------------------------------------------------------');
    console.log(`📍 Haritadaki Takım Notları Sayısı: ${team.mapNotes.length}`);
    console.log('=======================================================\n');

  } catch (error: any) {
    console.error('❌ Takım bilgileri alınamadı:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
