# @rustplus-platform/core 🛡️

TypeScript ile sıfırdan yazılmış, hafif, kararlı ve tamamen tip güvenli **Rust+ Companion** kütüphanesi.

Facepunch'ın resmi Companion protokolünü Protobuf ve WebSocket üzerinden doğrudan konuşan çekirdek SDK paketidir.

---

## 🚀 Özellikler

*   **Tip Güvenliği:** Tamamen TypeScript ile yazılmıştır.
*   **Merkezi Yapılandırma:** Değişebilir sunucu API ve sürüm URL'lerini `Config` katmanı üzerinden yönetir.
*   **Asenkron Eşleştirme:** Gönderilen istekler sequence ID'leri ile eşleştirilerek asenkron Promise döner.
*   **Rate Limiting:** Token Bucket algoritması ile donatılmıştır, istekleri otomatik olarak kısarak sunucudan ban yemeyi engeller.
*   **Hata & Timeout Toleransı:** Sunucunun cevap vermediği durumlarda (network latency) belirlenen timeout süresinde Promise'lar otomatik temizlenir.
*   **FCM Pairing Desteği:** `PairingListener` modülü ile oyun içi sunucu ve cihaz eşleştirme isteklerini yakalar.
*   **Kapsamlı API:** CCTV kameraları (Camera rays / stream), Klanlar (Motd, chat), Cihazlar, Sohbet ve Takım takibi.

---

## 📦 Kurulum

```bash
pnpm add @rustplus-platform/core
# veya
npm install @rustplus-platform/core
```

FCM pairing özelliğini kullanacaksanız isteğe bağlı alıcı paketini ayrıca kurun:

```bash
npm install @liamcottle/push-receiver
```

---

## ⚡ Hızlı Başlangıç (Quick Start)

```typescript
import { RustClient } from '@rustplus-platform/core';

// 1. İstemciyi Yapılandır
const client = new RustClient({
  serverIp: '123.456.789.0',
  serverPort: 28082,
  steamId: '76561198000000000',
  playerToken: 123456789,
});

// 2. Bağlantı Olaylarını Dinle
client.on('connected', () => console.log('🟢 Sunucuya bağlandı!'));
client.on('disconnected', () => console.log('🔴 Bağlantı koptu.'));
client.on('error', (err) => console.error('❌ Hata:', err.message));

// 3. Canlı Olayları (Events) Dinle
client.on('teamMessage', (msg) => {
  console.log(`[Takım] ${msg.name}: ${msg.message}`);
});

client.on('entityChanged', (data) => {
  console.log(`Cihaz durumu değişti. ID: ${data.entityId}, Değer: ${data.payload.value}`);
});

async function main() {
  // 4. Bağlan
  await client.connect();

  // 5. Sunucu Bilgilerini Al
  const info = await client.getInfo();
  console.log(`Sunucu: ${info.name} (${info.players}/${info.maxPlayers})`);

  // 6. Takım Listesini Al
  const team = await client.getTeamInfo();
  console.log('Takım Üyeleri:', team.members.map(m => m.name));

  // 7. Akıllı Şalteri Aç (Entity ID: 123456)
  await client.turnSmartSwitchOn(123456);
}

main().catch(console.error);
```

---

## 🗺️ Numaralı Örnekler (Examples)

SDK'yı daha detaylı incelemek için `examples/` klasörü altındaki numaralandırılmış TypeScript örneklerini inceleyebilirsiniz:

1.  `01-connect.ts`: WebSocket bağlantısı kurma ve kapatma.
2.  `02-get-info.ts`: Detaylı sunucu bilgileri alma.
3.  `03-get-map.ts`: Harita binary görüntüsünü çekip diske JPG olarak kaydetme.
4.  `04-get-team.ts`: Takım üyeleri ve pozisyonlarının takibi.
5.  `05-devices.ts`: Akıllı şalter açma/kapama ve canlı bildirimleri dinleme.
6.  `06-chat.ts`: Takım sohbet geçmişi ve mesaj gönderme.
7.  `07-camera.ts`: CCTV kamera takibi ve kontrol girdileri gönderme.
8.  `08-clan.ts`: Klan bilgileri, klan sohbeti ve MOTD güncelleme.
9.  `09-pairing.ts`: FCM Pairing sunucusunu dinleme ve eşleştirme bildirimleri yakalama.
10. `10-switch-server.ts`: Bağlantıyı kesip farklı bir sunucuya dinamik olarak geçme.

Örneklerin açıklamaları ve çalıştırma detayları için [examples/README.md](examples/README.md) dosyasına göz atın.

---

## 🧪 Kararlılık ve Testler

SDK, ağ gecikmesi (ping latency), paket kaybı (packet loss) ve eşzamanlı 100 istek yük testleri dahil olmak üzere kapsamlı bir test süiti ile korunmaktadır.

Derleme, testler ve dağıtım paketi doğrulamasını birlikte çalıştırmak için:

```bash
npm run check
```

Coverage raporu oluşturmak için:

```bash
npm run test:coverage
```

---

## 📄 Lisans

MIT
