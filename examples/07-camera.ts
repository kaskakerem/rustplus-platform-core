/**
 * @fileoverview Örnek 07: CCTV Kamera Takibi (Camera Stream)
 * 
 * Bu örnekte, bir CCTV kamerasına nasıl abone olunacağını,
 * kamera hareket kontrol girdilerinin (input) nasıl gönderileceğini
 * ve gelen ham ışın (ray) verilerinin nasıl dinleneceğini göreceğiz.
 * 
 * Çalıştırmak için:
 * pnpm tsx examples/07-camera.ts
 */

import { RustClient } from '../src/index';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const serverIp = process.env.RUST_SERVER_IP || '127.0.0.1';
const serverPort = parseInt(process.env.RUST_SERVER_PORT || '28082');
const steamId = process.env.RUST_STEAM_ID || '76561198000000000';
const playerToken = parseInt(process.env.RUST_PLAYER_TOKEN || '123456789');

// Test etmek istediğiniz kamera tanımlayıcısı (ör: DOME1, OILRIG1 vb.)
const targetCameraId = process.env.TARGET_CAMERA_ID || 'OILRIG1';

async function run() {
  const client = new RustClient({ serverIp, serverPort, steamId, playerToken });

  // Kamera ışın verilerini (ray data) dinle
  client.on('cameraRays', (rays) => {
    console.log(`\n📹 [Kamera Canlı Veri] Fov: ${rays.verticalFov}, Mesafe: ${rays.distance}`);
    console.log(`   Algılanan Entity Sayısı: ${rays.entities?.length || 0}`);
  });

  try {
    await client.connect();

    console.log(`⏳ Kameraya abone olunuyor: ${targetCameraId}...`);
    const camInfo = await client.subscribeToCamera(targetCameraId);
    
    console.log('\n=================== KAMERA BİLGİLERİ ===================');
    console.log(`📐 Çözünürlük: ${camInfo.width}x${camInfo.height}`);
    console.log(`👁️ Yakın Plan:  ${camInfo.nearPlane}, Uzak Plan: ${camInfo.farPlane}`);
    console.log('========================================================\n');

    // 2 saniye boyunca kamerayı hareket ettirme simülasyonu yapalım
    console.log('⏳ Kameraya sağa/yukarı hareket girdisi gönderiliyor...');
    for (let i = 0; i < 5; i++) {
      // buttons: 0 (düğme basılı değil), mouseDeltaX: 10, mouseDeltaY: 5
      await client.sendCameraInput(0, 10, 5);
      await new Promise((resolve) => setTimeout(resolve, 400));
    }

    // Görüntü verilerini izlemek için 5 saniye bekle
    console.log('⏳ Kamera yayın verilerini dinlemek için 5 saniye bekleniyor...');
    await new Promise((resolve) => setTimeout(resolve, 5000));

    // Kameradan ayrıl
    console.log('⏳ Kameradan ayrılınıyor...');
    await client.unsubscribeFromCamera();
    console.log('🟢 Kameradan ayrılındı.');

  } catch (error: any) {
    console.error('❌ Kamera hatası:', error.message);
  } finally {
    client.disconnect();
  }
}

run();
