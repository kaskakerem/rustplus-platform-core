/**
 * @fileoverview Örnek 05: Akıllı Cihaz Kontrolü (Smart Devices)
 * 
 * Bu örnekte, bir akıllı şalterin (Smart Switch) durumunu nasıl sorgulayacağımızı,
 * durumunu nasıl değiştireceğimizi ve canlı bildirimleri (alarm tetiklendi,
 * switch açıldı vb.) nasıl dinleyeceğimizi göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/05-devices.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverIp = process.env.RUST_SERVER_IP || '127.0.0.1';
const serverPort = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

// Test etmek istediğiniz akıllı şalter / alarm Entity ID'si
const targetEntityId = parseInt(process.env.TARGET_ENTITY_ID || '123456');

async function run() {
  const client = new RustClient({ serverIp, serverPort, steamId, playerToken });

  // Canlı cihaz değişikliklerini dinle
  client.on('entityChanged', (data) => {
    console.log(`\n📡 [Canlı Değişiklik] Cihaz ID: ${data.entityId} güncellendi!`);
    console.log(`   Değer: ${data.payload.value ? '🟢 AÇIK' : '🔴 KAPALI'}`);
    if (data.payload.items && data.payload.items.length > 0) {
      console.log('   İçerik:', data.payload.items);
    }
  });

  try {
    await client.connect();

    console.log(`⏳ ID: ${targetEntityId} olan cihazın mevcut durumu sorgulanıyor...`);
    const entity = await client.getEntityInfo(targetEntityId);
    console.log(`ℹ️ Cihaz Türü: ${entity.type}`);
    console.log(`ℹ️ Mevcut Durum: ${entity.payload.value ? 'AÇIK' : 'KAPALI'}`);

    // Cihaza abone ol (canlı güncellemeleri almak için gerekli)
    console.log(`⏳ ID: ${targetEntityId} için canlı bildirim aboneliği başlatılıyor...`);
    await client.subscribe(targetEntityId);
    console.log('🟢 Canlı güncellemeler başarıyla abone olundu.');

    // 2 saniye bekle ve şalteri AÇ
    await new Promise((resolve) => setTimeout(resolve, 2000));
    console.log(`⏳ ID: ${targetEntityId} şalteri AÇILIYOR...`);
    await client.turnSmartSwitchOn(targetEntityId);

    // 4 saniye bekle ve şalteri KAPAT
    await new Promise((resolve) => setTimeout(resolve, 4000));
    console.log(`⏳ ID: ${targetEntityId} şalteri KAPATILIYOR...`);
    await client.turnSmartSwitchOff(targetEntityId);

    // Canlı event'leri gözlemlemek için 5 saniye daha bekle
    console.log('⏳ Canlı olayları dinlemek için 5 saniye bekleniyor...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

  } catch (error: any) {
    console.error('❌ Cihaz kontrol hatası:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
