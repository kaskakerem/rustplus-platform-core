/**
 * @fileoverview Örnek 08: Klan Desteği (Clan Support)
 * 
 * Bu örnekte, klan üyelerini, klan sohbet geçmişini sorgulamayı,
 * klan sohbetine mesaj göndermeyi ve günün mesajını (MOTD) güncellemeyi göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/08-clan.ts
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

  // Canlı klan sohbet mesajlarını dinle
  client.on('clanMessage', (data) => {
    console.log(`🏰 [Klan Sohbet] [ID: ${data.clanId}] ${data.message.name}: ${data.message.message}`);
  });

  // Klan bilgileri değişimlerini dinle
  client.on('clanChanged', (data) => {
    console.log('🏰 [Klan Güncellemesi] Güncel MOTD:', data.clanInfo.motd);
  });

  try {
    await client.connect();

    console.log('⏳ Klan bilgileri sorgulanıyor...');
    const clanInfo = await client.getClanInfo();

    if (clanInfo && clanInfo.clanInfo) {
      const clan = clanInfo.clanInfo;
      console.log('\n=================== KLAN BİLGİLERİ ===================');
      console.log(`🏰 Klan Adı:  ${clan.name}`);
      console.log(`📝 Günün Mesajı (MOTD): "${clan.motd}"`);
      console.log(`👥 Üye Sayısı: ${clan.members.length}`);
      console.log(`🛡️ Rol Sayısı: ${clan.roles.length}`);
      console.log('=======================================================\n');

      // Klan sohbet geçmişini sorgula
      console.log('⏳ Klan sohbet geçmişi sorgulanıyor...');
      const chat = await client.getClanChat();
      console.log('\n--- KLAN SOHBET GEÇMİŞİ ---');
      chat.messages.slice(-3).forEach((msg) => {
        console.log(`[${msg.name}]: ${msg.message}`);
      });
      console.log('---------------------------\n');

      // Klan sohbetine mesaj gönder
      const testMsg = 'Rust+ Core SDK klan test mesajı! 🛡️';
      console.log(`⏳ Klan sohbetine mesaj gönderiliyor: "${testMsg}"`);
      await client.sendClanMessage(testMsg);

      // Klan MOTD (Günün Mesajı) değiştir
      const newMotd = `Klan MOTD güncellendi! Saat: ${new Date().toLocaleTimeString()}`;
      console.log(`⏳ Klan MOTD'si güncelleniyor: "${newMotd}"`);
      await client.setClanMotd(newMotd);
      console.log('🟢 Klan işlemleri başarıyla tamamlandı.');

      // Olayları izlemek için 5 saniye bekle
      await new Promise((resolve) => setTimeout(resolve, 5000));
    } else {
      console.log('⚠️ Bir klana üye değilsiniz veya sunucuda klan desteği yok.');
    }

  } catch (error: any) {
    console.error('❌ Klan işlemleri başarısız:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
