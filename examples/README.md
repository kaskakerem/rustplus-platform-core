# 📂 Rust+ Core SDK Örnek Uygulamalar (Examples)

Bu dizin, `@rustplus-platform/core` paketinin temel yeteneklerini ve komutlarını sırayla deneyimleyebilmeniz için tasarlanmış numaralandırılmış TypeScript örneklerini içerir.

---

## ⚙️ Gereksinimler & Yapılandırma

Tüm örnekler projenin root dizinindeki `.env` dosyasındaki kimlik bilgilerini kullanır. Örnekleri çalıştırmadan önce root dizinde bir `.env` dosyası oluşturun ve aşağıdaki şablonu doldurun:

```env
# İlk Sunucu Bilgileri
RUST_SERVER_IP=123.456.789.0
RUST_SERVER_PORT=28082
RUST_STEAM_ID=76561198000000000
RUST_PLAYER_TOKEN=123456789

# Testler için İkinci Sunucu (Örnek 10)
RUST_SERVER_2_IP=123.456.789.1
RUST_SERVER_2_PORT=28082
RUST_PLAYER_TOKEN_2=987654321

# Cihaz Kontrolü Testi için Örnek Entity ID (Örnek 05)
TARGET_ENTITY_ID=123456

# CCTV Kamera Testi için Örnek Kamera ID (Örnek 07)
TARGET_CAMERA_ID=OILRIG1

# GCM / FCM Push Bildirimleri için (Örnek 09)
GCM_ANDROID_ID=your-android-id
GCM_SECURITY_TOKEN=your-security-token
```

---

## 🏃‍♂️ Örnekleri Çalıştırma

Örnekleri doğrudan derlemeye ihtiyaç duymadan TypeScript olarak çalıştırmak için `tsx` aracı kullanılır. 
Root bağımlılıkları veya yerel bağımlılıkları kurduktan sonra aşağıdaki komutları `packages/core/` dizini içinden çalıştırabilirsiniz:

### 01. Bağlantı (Connection)
Sadece WebSocket bağlantısı kurar, 5 saniye bekler ve kapatır.
```bash
pnpm tsx examples/01-connect.ts
```
**Beklenen Çıktı:**
```
🔄 İstemci yapılandırılıyor...
⏳ Sunucuya bağlanılıyor...
🟢 Sunucuya başarıyla bağlandı!
🎉 Bağlantı kanıtlandı! 5 saniye sonra kapatılıyor...
🔌 Bağlantı kapatıldı.
```

### 02. Sunucu Bilgisi (Server Info)
Sunucunun adını, oyuncu sayısını, wipe süresini ve harita boyutunu çeker.
```bash
pnpm tsx examples/02-get-info.ts
```

### 03. Haritayı Kaydetme (Save Map)
Sunucunun binary harita JPG görüntüsünü çeker ve yerel diske `rust_map.jpg` olarak kaydeder.
```bash
pnpm tsx examples/03-get-map.ts
```

### 04. Takım Bilgileri (Team Details)
Takım liderini, takım üyelerinin çevrimiçi durumlarını, hayatta olup olmadıklarını ve koordinatlarını listeler.
```bash
pnpm tsx examples/04-get-team.ts
```

### 05. Akıllı Cihaz Kontrolü (Smart Devices)
Belirtilen bir akıllı şalteri 2 saniye sonra AÇAR, 4 saniye sonra KAPATIR ve canlı durum değişikliklerini (events) ekrana basar.
```bash
pnpm tsx examples/05-devices.ts
```

### 06. Takım Sohbeti (Team Chat)
Takım sohbet geçmişindeki son 5 mesajı çeker, sohbete test mesajı gönderir ve canlı yeni mesajları dinler.
```bash
pnpm tsx examples/06-chat.ts
```

### 07. CCTV Kamera Takibi (Camera Stream)
Belirli bir kameraya (örn: OILRIG1) abone olur, kamerayı hareket ettirmek için fare girdileri simüle eder ve ham ışın (ray) verilerini dinler.
```bash
pnpm tsx examples/07-camera.ts
```

### 08. Klan Desteği (Clan Details)
Klan bilgilerini sorgular, klan günün mesajını (MOTD) günceller, klan sohbetine mesaj gönderir ve canlı klan olaylarını dinler.
```bash
pnpm tsx examples/08-clan.ts
```

### 09. Eşleştirme Bildirimleri (Pairing Listener)
FCM push bildirim sunucusuna bağlanır. Oyun içinden "Sunucu Eşleştir" veya "Cihaz Eşleştir" butonlarına basıldığında gelen verileri ekrana basar.
```bash
pnpm tsx examples/09-pairing.ts
```

### 10. Dinamik Sunucu Değiştirme (Switch Server)
Tek bir RustClient nesnesiyle, aktif bağlantıyı kapatıp anında farklı bir sunucuya (`switchServer`) geçiş yapmayı gösterir.
```bash
pnpm tsx examples/10-switch-server.ts
```
