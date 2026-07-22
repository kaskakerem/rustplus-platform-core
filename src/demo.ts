/**
 * @fileoverview SDK Kullanım Örneği (Demo)
 * 
 * Bu dosya, bir geliştiricinin @rustplus-platform/core paketini
 * projesine dahil ettiğinde nasıl kullanacağını simüle eder.
 */

import { RustClient, PairingListener } from './index';

async function main() {
  console.log('--- Rust+ SDK Demo Başlatılıyor ---');

  // 1. İstemci Yapılandırması
  const client = new RustClient({
    serverIp: '127.0.0.1', // Gerçek sunucu IP'si buraya gelecek
    serverPort: 28082,     // Rust+ Portu (app.port)
    steamId: '76561198000000000',
    playerToken: 123456789,
    useFacepunchProxy: false, // Doğrudan bağlantı denemesi
    autoReconnect: true,
  });

  // 2. Olay Dinleyicileri (Events)
  client.on('connecting', () => {
    console.log('🔄 Sunucuya bağlanılıyor...');
  });

  client.on('connected', () => {
    console.log('🟢 Sunucuya başarıyla bağlanıldı!');
  });

  client.on('disconnected', () => {
    console.log('🔴 Bağlantı koptu.');
  });

  client.on('reconnecting', (attempt) => {
    console.log(`🔁 Yeniden bağlanılıyor... Deneme #${attempt}`);
  });

  client.on('error', (err) => {
    console.error('❌ SDK Hatası:', err.message);
  });

  // Oyun içi takım mesajlarını dinle
  client.on('teamMessage', (msg) => {
    console.log(`💬 [Takım] ${msg.name}: ${msg.message}`);
  });

  // Cihaz durum güncellemelerini dinle
  client.on('entityChanged', (data) => {
    console.log(`📡 [Cihaz Güncellemesi] Entity ID: ${data.entityId}`, data.payload);
  });

  // 3. Bağlantıyı Başlat ve İstek Gönder
  try {
    // client.connect() hem protobuf'u yükler hem de WebSocket'i açar
    await client.connect();

    // Temel sunucu bilgilerini çek
    console.log('⏳ Sunucu bilgileri isteniyor...');
    const info = await client.getInfo();
    console.log(`ℹ️ Sunucu Adı: ${info.name}`);
    console.log(`ℹ️ Aktif Oyuncu: ${info.players}/${info.maxPlayers}`);

    // Takım bilgilerini çek
    console.log('⏳ Takım bilgileri isteniyor...');
    const team = await client.getTeamInfo();
    console.log(`ℹ️ Takım Lideri: ${team.leaderSteamId}`);
    console.log(`ℹ️ Üye Sayısı: ${team.members.length}`);

    // Bir akıllı şalteri aç (örnek entityId: 9999)
    // console.log('⏳ Şalter açılıyor...');
    // await client.turnSmartSwitchOn(9999);

  } catch (error: any) {
    console.error('💥 İşlem hatası:', error.message);
  } finally {
    // Demo bittiğinde bağlantıyı kapat
    client.disconnect();
    console.log('--- Demo Bitti ---');
  }
}

// FCM Eşleştirme Dinleyicisi Örneği
function setupPairingDemo() {
  const pairing = new PairingListener({
    androidId: 'gcm-android-id-degeri',
    securityToken: 'gcm-security-token-degeri',
  });

  pairing.on('serverPaired', (server) => {
    console.log(`📱 Yeni Sunucu Eşleştirildi: ${server.name} (${server.ip}:${server.port})`);
    console.log(`🔑 Token: ${server.playerToken}, SteamID: ${server.steamId}`);
  });

  pairing.on('entityPaired', (entity) => {
    console.log(`📱 Yeni Cihaz Eşleştirildi: ${entity.customName} (${entity.type})`);
  });

  // pairing.start().catch(console.error);
}

// Çalıştır
main().catch(console.error);
