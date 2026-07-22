/**
 * @fileoverview Örnek 09: FCM Eşleştirme Dinleyicisi (Pairing Listener)
 * 
 * Bu örnekte, Google FCM sunucularına bağlanarak Rust oyunundan
 * gelen "Sunucu Eşleştirildi" veya "Cihaz Eşleştirildi" push bildirimlerini
 * nasıl canlı olarak yakalayacağımızı göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/09-pairing.ts
 */

import { PairingListener } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

// Google Cloud Messaging / Firebase Cloud Messaging kimlik bilgileri
// Bu değerler Google kaydı sonucu elde edilir
const androidId = process.env.GCM_ANDROID_ID || '';
const securityToken = process.env.GCM_SECURITY_TOKEN || '';

async function run() {
  if (!androidId || !securityToken) {
    console.error('❌ GCM_ANDROID_ID ve GCM_SECURITY_TOKEN değerleri .env dosyasında tanımlı olmalıdır!');
    console.log('FCM Pairing testini atlamak için .env dosyanızı doldurun.');
    return;
  }

  console.log('🔄 PairingListener başlatılıyor...');
  
  const pairing = new PairingListener({ androidId, securityToken });

  // Olay Dinleyicileri
  pairing.on('serverPaired', (server) => {
    console.log('\n======================================================');
    console.log('🎮 SUNUCU EŞLEŞTİRME BİLDİRİMİ ALINDI!');
    console.log(`   Sunucu Adı:  ${server.name}`);
    console.log(`   Adres:       ${server.ip}:${server.port}`);
    console.log(`   Steam ID:    ${server.steamId}`);
    console.log(`   Player Token:${server.playerToken}`);
    console.log('======================================================\n');
  });

  pairing.on('entityPaired', (entity) => {
    console.log('\n======================================================');
    console.log('📡 CİHAZ (ENTITY) EŞLEŞTİRME BİLDİRİMİ ALINDI!');
    console.log(`   Cihaz Adı:   ${entity.customName}`);
    console.log(`   Tür:         ${entity.type}`);
    console.log(`   Entity ID:   ${entity.entityId}`);
    console.log(`   Sunucu:      ${entity.serverIp}:${entity.serverPort}`);
    console.log('======================================================\n');
  });

  pairing.on('alarm', (alarm) => {
    console.log(`🚨 [Canlı Alarm Bildirimi] ${alarm.title} - ${alarm.message}`);
  });

  pairing.on('error', (err) => {
    console.error('❌ FCM Dinleme Hatası:', err.message);
  });

  try {
    // FCM dinleyiciyi başlat
    await pairing.start();
    console.log('🟢 Google Push sunucularına bağlanıldı. Rust içinden pairing istekleri bekleniyor...');
    console.log('Durdurmak için Ctrl+C tuşlarına basın.');

    // 30 saniye boyunca dinle
    await new Promise((resolve) => setTimeout(resolve, 30000));
  } catch (error: any) {
    console.error('💥 FCM bağlantı hatası:', error.message);
  } finally {
    pairing.stop();
    console.log('🔌 FCM dinleyici durduruldu.');
  }
}

run();
