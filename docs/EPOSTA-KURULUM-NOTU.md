# E-posta Kurulum Notu — info@saprintpro.com

> **Durum:** ⏸️ **BEKLEMEDE**
> Kullanıcı **uygulama şifresi (App Password)** aşamasında takıldı. Kurulum
> sonradan tamamlanacak. Bu dosya, kaldığı yerden devam etmek için adım adım
> yol haritasıdır.

---

## Hedef

| Alan | Değer |
| --- | --- |
| **Gelen kutusu (yönlendirme)** | `info@saprintpro.com` → `sametscar@gmail.com` |
| **Giden (send-as)** | `sametscar@gmail.com` üzerinden `info@saprintpro.com` olarak gönderim |
| **Cloudflare hesabı** | `acar32@gmail.com` |
| **Alan adı** | `saprintpro.com` (Cloudflare DNS) |

---

## BÖLÜM A — Cloudflare Email Routing (GELEN posta)

Amaç: `info@saprintpro.com` adresine gelen tüm e-postaları `sametscar@gmail.com`
Gmail kutusuna yönlendirmek. Ücretsizdir, ek mail sunucusu gerekmez.

1. **Cloudflare paneline gir**
   - `dash.cloudflare.com` → hesap: **`acar32@gmail.com`**
   - `saprintpro.com` alan adını seç
2. **Email Routing'ı aç**
   - Sol menü: **Email** → **Email Routing** → **Enable** (Etkinleştir)
3. **DNS kayıtlarını otomatik ekle**
   - MX ve TXT kayıtları için **"Add records automatically"** butonuna bas
   - (Cloudflare gerekli MX + SPF TXT kayıtlarını kendisi ekler)
4. **Hedef adresi doğrula (Destination addresses)**
   - **Destination addresses** → **Add destination address**
   - Adres: `sametscar@gmail.com`
   - Gmail'e gelen **doğrulama linkine tıkla** (bu adım zorunlu)
5. **Yönlendirme kuralı oluştur (Routes)**
   - **Routes** → **Create address**
   - **Custom address:** `info`
   - **Action:** **Send to** → `sametscar@gmail.com`
   - Kaydet
6. **(Opsiyonel) Catch-all**
   - **Catch-all address** → **Enable**
   - Böylece `info@` dışındaki tüm adresler (ör. `destek@`, `siparis@`) de
     `sametscar@gmail.com`'a düşer

> ✅ Bölüm A tamamlandığında `info@saprintpro.com`'a gelen postalar Gmail'e düşer.

---

## BÖLÜM B — Gmail "Send mail as" (GİDEN posta)

Amaç: Gmail'den `info@saprintpro.com` adresiyle **gönderim** yapabilmek
(müşteriye cevap verirken profesyonel görünüm).

1. **Gmail ayarlarını aç**
   - `sametscar@gmail.com` ile giriş yap
   - Sağ üst **⚙️** → **Tüm ayarları gör** (See all settings)
   - Sekme: **Hesaplar ve İçe Aktarma** (Accounts and Import)
2. **Yeni gönderim adresi ekle**
   - **"Postaları şu adresten gönder"** (Send mail as) bölümü
   - **"Bir e-posta adresi daha ekle"** (Add another email address) tıkla
3. **Adres bilgilerini gir**
   - **Ad:** `SA Printpro`
   - **E-posta:** `info@saprintpro.com`
   - **"Takma ad olarak değerlendir"** (Treat as an alias) → **İŞARETLE** ✅
     - ⚠️ Bu kutu işaretlenmezse Gmail, gönderimde `sametscar@gmail.com`
       adresini "gönderen" olarak gösterebilir.
4. **SMTP sunucu bilgileri**
   - **SMTP Sunucusu:** `smtp.gmail.com`
   - **Kullanıcı Adı:** `sametscar@gmail.com`
   - **Şifre:** **Uygulama Şifresi** (aşağıya bakın — normal Gmail şifresi DEĞİL)
   - **Port:** `587`
   - **Bağlantı:** **TLS** (güvenli bağlantı)
5. **Uygulama Şifresi oluştur** (kullanıcının takıldığı adım)
   - `myaccount.google.com/security` adresine git
   - **2 Adımlı Doğrulama (2-Step Verification)** açık olmalı — kapalıysa önce aç
   - **Uygulama şifreleri** (App passwords) → yeni oluştur
   - Uygulama: "Posta" / Cihaz: "Diğer (özel ad)" → ör. `SA Printpro SMTP`
   - Google **16 haneli** bir şifre üretir (ör. `abcd efgh ijkl mnop`)
   - ⚠️ Bu, Gmail hesap şifreniz **DEĞİLDİR**; sadece bu amaçla üretilen
     tek kullanımlık şifredir. Boşlukları yok sayarak 4. adımdaki **Şifre**
     alanına yapıştırın.
6. **Doğrulama kodunu gir**
   - Gmail, `info@saprintpro.com` adresine bir **doğrulama kodu** gönderir
   - Bu kod `sametscar@gmail.com`'a düşer (Bölüm A sayesinde)
   - Kodu ilgili alana gir → **Doğrula** (Verify)

> ✅ Bölüm B tamamlandığında Gmail'de "Kimden" alanında `info@saprintpro.com`
> seçilebilir olur.

---

## BÖLÜM C — SPF kaydı (ÖNERİLİR)

Amaç: Gmail üzerinden `info@saprintpro.com` adına gönderilen postaların spam'e
düşmemesi ve alıcı sunucuların gönderimi yetkili görmesi.

- **Cloudflare DNS** → **TXT** kaydı ekle
- **Ad (Name):** `@`
- **İçerik (Content):**
  ```
  v=spf1 include:_spf.mx.cloudflare.net include:_spf.google.com ~all
  ```
- **TTL:** Auto

> ⚠️ Bir alan adında **yalnızca bir adet** SPF TXT kaydı olabilir. Zaten SPF
> kaydı varsa yeni kayıt eklemek yerine mevcut kaydı bu içerikle güncelleyin.

---

## Uyarılar ve Notlar

1. **Sıra önemli:** Önce **Bölüm A** (Cloudflare Email Routing) yapılmalıdır.
   Aksi halde Bölüm B'deki Gmail doğrulama kodu `info@saprintpro.com` adresine
   gönderilir ve hiçbir yere ulaşmaz → kurulum tamamlanamaz.
2. **Gmail depolama alanı %95 dolu.** Yönlendirme başladıktan sonra gelen
   postalar bu kotayı daha da dolduracaktır. Kurulumdan önce/sonra Gmail
   depolamasının temizlenmesi (eski ekler, büyük postalar, Çöp Kutusu/Spam
   boşaltma) gerekir. Aksi halde yeni postalar reddedilebilir.
3. **Uygulama şifresi ≠ Gmail şifresi.** Kullanıcının takıldığı nokta budur.
   Normal Gmail şifresi SMTP'de çalışmaz; mutlaka 2 Adımlı Doğrulama açıkken
   üretilen 16 haneli uygulama şifresi kullanılmalıdır.
4. **"Takma ad olarak değerlendir"** kutusu işaretlenmezse Gmail, gönderimde
   `sametscar@gmail.com` adresini görünür "gönderen" olarak ekleyebilir.
5. **DNS yayılımı:** MX/TXT değişiklikleri Cloudflare'de genelde hızlı (dakikalar)
   yayılır; ancak uçtan uca doğrulama için birkaç dakika beklemek gerekebilir.

---

## Kontrol Listesi (Devam ederken işaretle)

- [ ] **A1** Cloudflare → Email Routing → Enable
- [ ] **A2** MX/TXT → "Add records automatically"
- [ ] **A3** Destination: `sametscar@gmail.com` eklendi + Gmail'de doğrulandı
- [ ] **A4** Route: `info` → Send to `sametscar@gmail.com`
- [ ] **A5** (Opsiyonel) Catch-all → Enable
- [ ] **B1** Gmail → Hesaplar ve İçe Aktarma → "Bir e-posta adresi daha ekle"
- [ ] **B2** Ad `SA Printpro`, e-posta `info@saprintpro.com`, "Takma ad" işaretli
- [ ] **B3** SMTP `smtp.gmail.com`, kullanıcı `sametscar@gmail.com`, port `587`, TLS
- [ ] **B4** Uygulama şifresi oluşturuldu (16 hane) ve girildi
- [ ] **B5** Gmail doğrulama kodu girildi → Doğrulandı
- [ ] **C1** SPF TXT kaydı eklendi/güncellendi
- [ ] **D1** Gmail depolama temizliği yapıldı

---

## Test (Kurulum sonrası)

1. Dış bir adresten (ör. başka bir Gmail) `info@saprintpro.com`'a mail at →
   `sametscar@gmail.com` gelen kutusuna düşmeli.
2. Gmail'de yeni mail oluştur → "Kimden" alanında `info@saprintpro.com` seç →
   gönder → alıcıda gönderen `info@saprintpro.com` görünmeli.
3. Gönderilen mailin başlığında `SPF: pass` olmalı (spam'e düşmemeli).

---

*Bu not, kurulum tamamlanana kadar "BEKLEMEDE" durumundadır. Tamamlandığında
durumu "TAMAMLANDI" olarak güncelleyin.*
