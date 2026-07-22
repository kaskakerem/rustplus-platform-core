/**
 * @fileoverview Örnek 06: Takım Sohbeti (Team Chat)
 * 
 * Bu örnekte, takım sohbetine nasıl mesaj gönderileceğini ve
 * gelen yeni sohbet mesajlarının canlı olarak nasıl yakalanacağını göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/06-chat.ts
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

  // Canlı sohbet mesajlarını dinle
  client.on('teamMessage', (msg) => {
    const timeStr = new Date(msg.time * 1000).toLocaleTimeString();
    console.log(`💬 [${timeStr}] [${msg.name}]: ${msg.message}`);
  });

  try {
    await client.connect();

    // Sohbet geçmişini sorgula
    console.log('⏳ Son sohbet geçmişi çekiliyor...');
    const chat = await client.getTeamChat();
    console.log('\n--- SOHBET GEÇMİŞİ ---');
    chat.messages.slice(-5).forEach((msg: any) => {
      console.log(`[${msg.name}]: ${msg.message}`);
    });
    console.log('----------------------\n');

    // Takım sohbetine mesaj gönder
    const demoMessage = 'Rust+ Core SDK üzerinden gönderilen test mesajı! 🚀';
    console.log(`⏳ Takım sohbetine mesaj gönderiliyor: "${demoMessage}"`);
    await client.sendTeamMessage(demoMessage);
    console.log('🟢 Mesaj başarıyla gönderildi.');

    // Yeni gelen mesajları dinlemek için 10 saniye bekle
    console.log('⏳ Yeni mesajları dinlemek için 10 saniye bekleniyor...');
    await new Promise((resolve) => setTimeout(resolve, 10000));

  } catch (error: any) {
    console.error('❌ Sohbet hatası:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
