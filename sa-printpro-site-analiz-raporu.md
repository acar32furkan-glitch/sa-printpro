# SA Printpro — Site Analiz Raporu

**İncelenen adres:** sa-printpro.acar32furkan.workers.dev (canonical: saprintpro.com)
**Tarih:** Eylül 2026
**Kapsam:** Teknik/SEO, içerik, ürün sayfası, sipariş akışı, marka/UX, Trendyol-web sitesi ilişkisi

---

## 1. Genel Tablo

Site, Astro ile üretilmiş statik bir "vitrin" (showcase) sitesi. 235 ürün / 9 kategori, WhatsApp üzerinden sipariş alınan, gerçek bir e-ticaret altyapısı (sepet, ödeme, hesap) olmayan bir yapı. Ürün verisi (görseller, açıklamalar, SSS, özellikler) büyük ölçüde Trendyol mağazasından aktarılmış görünüyor — görsellerin bir kısmı hâlâ `cdn.dsmcdn.com` (Trendyol'un kendi CDN'i) üzerinden geliyor, kendi sunucunuza taşınmamış.

Temel iş modeli fikri doğru: Trendyol'daki listeleme fiyatının üzerine "web sitesine özel %20 indirim" koyup müşteriyi WhatsApp'tan doğrudan siparişe yönlendirerek komisyonsuz satış yapmak. Ancak uygulamada hem teknik hem stratejik açıdan ciddi boşluklar var.

---

## 2. Kritik / Acil Sorunlar

Bunlar öncelik sırasına göre en yüksek etkili maddeler:

1. **Canonical domain (saprintpro.com) yayında değil / indekslenmemiş.** Tüm meta etiketler, sitemap referansları ve paylaşım linkleri `saprintpro.com`'u gösteriyor ama arama motorlarında bu alan adına dair hiçbir iz yok. Şu an gerçek erişim sadece `*.workers.dev` alt alan adından. Bu, hem markanın güvenilirliğini (bir workers.dev adresi tüketiciye "geçici/test sitesi" hissi verir) hem de tüm SEO çalışmasının anlamını doğrudan etkiliyor. **En yüksek öncelik.**
2. **Ödeme/sipariş vaadiyle gerçek akış uyuşmuyor.** Mesafeli Satış sözleşmesinde "Satın Al butonları sizi Trendyol veya Shopier'e yönlendirir" yazıyor; ürün sayfasında ise tek buton var: "İndirimli Sipariş Ver (WhatsApp)". Trendyol'a ya da Shopier'e giden hiçbir link yok. Aynı şekilde ürün kartında "Güvenli ödeme" ibaresi geçiyor ama WhatsApp'tan yazışarak sipariş vermek teknik olarak bir ödeme akışı değil. Bu tutarsızlık hem tüketici hukuku açısından risk (yazdığınızı yapmıyorsunuz) hem de güven kırıcı.
3. **Ürün açıklamalarında Trendyol'un zorunlu uyum metinleri birebir kalmış.** Örnek (Honda PCX ürününden): *"ECE uygunluk sembolü ürünün görselinde yer almamaktadır, bu nedenle güvenlik standartlarına uygun olmadığını kontrol etmeniz önerilir"* ve *"İthalatçı, yetkili temsilci veya ifa hizmet sağlayıcı bilgisi bulunmamaktadır; bu satın almadan önce satıcıya danışmanız tavsiye edilir."* Bunlar Trendyol'un platform içi zorunlu tüketici bilgilendirme şablonları — kendi markanızın sitesinde, kendi ürününüzü satarken bu ifadeler doğrudan "bu ürün güvenli olmayabilir, bilmiyoruz" mesajı veriyor ve satışı baltalıyor. Bu metinlerin tamamı yeniden yazılmalı.
4. **Ürün görselleri hâlâ Trendyol CDN'inden çekiliyor.** İlk görsel kendi sunucunuzda (`saprintpro.com/uploads/...`), diğer 6-7 görsel `cdn.dsmcdn.com` üzerinden geliyor. Trendyol bu görselleri istediği zaman kaldırabilir/değiştirebilir; ayrıca marka bağımsızlığı iddiasıyla çelişiyor.
5. **"Daha Fazla Göster (Kalan 145 Ürün)" — ürünlerin çoğu ilk yüklemede gelmiyor.** 235 üründen yalnızca ilk ~24-90 tanesi sayfa kaynağında geliyor, geri kalanı muhtemelen istemci tarafı (JS) ile yükleniyor. Bu, Google'ın ürünlerin büyük bölümünü hiç görmemesi anlamına gelebilir (SEO kaybı) ve aynı zamanda kötü bir kullanıcı deneyimi (245 ürün arasında "daha fazla göster" ile gezinmek).

---

## 3. Teknik & SEO Analizi

| Konu                                                | Durum                                                                                                                               | Not                                                                                                                            |
| --------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sitemap.xml                                         | Yok / erişilemiyor                                                                                                                 | Arama motorlarının 235 ürünü keşfetmesi zorlaşır                                                                       |
| robots.txt                                          | Kontrol edilemedi                                                                                                                   | Doğrulanmalı                                                                                                                 |
| Canonical URL                                       | saprintpro.com'a işaret ediyor ama bu domain yayında değil                                                                       | Kritik — bkz. madde 2.1                                                                                                       |
| Meta description / OG / Twitter card                | Var, düzgün dolu                                                                                                                  | Olumlu                                                                                                                         |
| Yapısal veri (Schema.org Product/Offer/Breadcrumb) | Görünürde yok                                                                                                                    | Google'da fiyat/stok/yıldız gibi zengin sonuçlar (rich snippet) çıkmaz — 235 ürünlük bir katalog için büyük kayıp |
| Sayfa başlıkları                                 | Ürün bazında özelleşmiş, iyi yazılmış (ör. "Honda PCX Jant Şeridi - Reflektif Motosiklet Stickeri Modelleri ve Fiyatı") | Olumlu                                                                                                                         |
| İçerik tekilliği                                 | Ürün açıklamaları şablonik ve birbirine çok benzer ("X, yerli üretim olup Türkiye'de üretilmiştir...")                   | Google'da "ince/kopya içerik" (thin content) olarak değerlendirilme riski var                                                |
| Sayfalama / lazy-load                               | "Daha Fazla Göster" ile client-side                                                                                                | Ürün kataloğunun büyük kısmı indekslenmeyebilir                                                                         |
| Mobil uyum                                          | Astro + görünürdeki yapı responsive görünüyor                                                                                | Gerçek cihazda test edilmeli                                                                                                  |
| Sayfa hızı                                        | Statik site olduğu için teorik olarak hızlı olmalı, ama Trendyol CDN'inden çekilen dış görseller ek gecikme yaratabilir    | Lighthouse ile ölçülmeli                                                                                                    |
| Site adı/marka tutarlılığı                     | "SA Printpro" başlıkta iyi kullanılmış                                                                                         | —                                                                                                                             |

**Öneriler:**

- `saprintpro.com` domainini gerçekten yayına alın, DNS/Cloudflare Workers custom domain ayarını tamamlayın.
- Sitemap.xml otomatik üretilip Google Search Console'a gönderilmeli.
- Ürün/kategori sayfalarına Schema.org `Product`, `Offer`, `BreadcrumbList`, `AggregateRating` (varsa) yapısal verisi eklenmeli.
- "Daha Fazla Göster" mekanizması SSR/statik sayfalama (`/urunler/sayfa-2` gibi) ile değiştirilmeli ki tüm 235 ürün HTML'de gerçekten var olsun.
- Tüm ürün görselleri kendi sunucunuza/objeye (R2, vs.) taşınmalı; Trendyol CDN bağımlılığı kaldırılmalı.

---

## 4. İçerik ve Ürün Sayfası Analizi

**Olumlu yönler:**

- Sipariş öncesi güven unsurları iyi düşünülmüş: "%100 Orijinal SA Printpro Üretimi", "2 Günde Kargoda", "15 Gün İade", "350 TL Üzeri Kargo Bedava".
- Her ürün sayfasında SSS bölümü var — bu hem kullanıcı hem SEO açısından değerli.
- Uygulama rehberi (sticker yapıştırma adımları) tekrar tekrar, tutarlı şekilde gösterilmiş; markalı bir "nasıl uygulanır" deneyimi var.
- "Benzer Ürünler" ile çapraz satış (cross-sell) mekanizması mevcut.

**Sorunlu yönler:**

- Ürün açıklamaları Trendyol'un otomatik/şablon oluşturduğu metinler gibi duruyor ve madde 2.3'te belirtilen olumsuz/belirsiz uyum ifadeleri barbarca kalmış.
- "Marka: Oracal" gibi bazı alanlarda üretici markası ile "SA Printpro" öz üretim iddiası çelişiyor gibi görünebilir (Oracal bir vinil/folyo markasıdır — muhtemelen hammadde markası ama açıklamada netleştirilmemiş, kafa karıştırabilir).
- Ürün adları büyük/küçük harf ve noktalama açısından tutarsız (ör. "KUPON HOLOGRAM STİCKER 2 ADET OTO MOTO AKSESUAR" tümü büyük harf, diğerleri normal) — profesyonellik algısını zedeliyor.
- Kategori isimlendirmesi karışık: "Motosiklet Lüzumlu Ürün" gibi bir kategori adı hem yazım hem SEO açısından zayıf (muhtemelen "gerekli ürün" kastedilmiş).
- 9 kategoriden 5'i (Ayna, Duvar Dekorasyon, Duvar Sticker, Motosiklet Lüzumlu Ürün) sadece 1'er ürün içeriyor — bu kategoriler hem gezinme deneyimini zayıflatıyor hem de "koca bir kategori sayfası, tek ürün" görüntüsü SEO'da zayıf sinyal.

---

## 5. Sipariş / Dönüşüm Akışı

Şu anki akış: Ürün sayfası → WhatsApp mesajı (otomatik dolduruluyor, bu iyi bir detay) → satıcıyla manuel yazışma → muhtemelen elden/havale ödeme.

**Sorunlar:**

- Gerçek bir ödeme sayfası/entegrasyonu yok; "Güvenli ödeme" ifadesi karşılığı olmayan bir vaat.
- WhatsApp akışı ölçeklenmez: sipariş sayısı arttıkça manuel yazışma yükü, yanıt gecikmesi, kaçan siparişler artar.
- Sepet yok — kullanıcı birden fazla ürün almak isterse her biri için ayrı WhatsApp mesajı göndermek zorunda kalır ya da tek mesajda hepsini kendisi listelemesi gerekir.
- Stok/fiyat senkronizasyonu: "Stokta (20000 adet)" gibi rakamlar muhtemelen Trendyol'dan otomatik çekiliyor ama gerçek stok takibi iki kanal arasında (Trendyol + WhatsApp siparişleri) manuel yürütülüyorsa tutarsızlık riski var.
- Ödeme güvencesi olmadan (kapıda ödeme/banka havalesi dışında) müşteri güveni, özellikle yeni/bilinmeyen bir markadan ilk kez alışveriş yapan biri için düşük olur.

**Öneriler (öncelik sırasıyla):**

1. Kısa vadede en azından **Shopier linkini gerçekten aktif edin** (mesafeli satış sözleşmesinde zaten vaat edilmiş) — kredi kartı ile gerçek "güvenli ödeme" sağlar, WhatsApp'ı ise "soru sor / özel sipariş" kanalı olarak bırakın.
2. Orta vadede basit bir sepet + Shopier/iyzico/PayTR checkout ekleyin ki birden fazla ürünü tek seferde alabilsinler.
3. WhatsApp mesaj şablonuna kargo/ödeme bilgisi netliği ekleyin (şu an sadece ürün adı ve fiyat var, ödeme yöntemi belirtilmiyor).

---

## 6. Marka, Tasarım ve UX

- Görsel dil sade ve karanlık tema (#09090b) kullanılmış, motosiklet/oto aksesuar sektörüne uygun bir seçim.
- Header çok minimal: sadece logo var. Arama kutusu yok — 235 ürünlük bir katalogda ürün arama olmaması ciddi bir eksik (kullanıcı "Yamaha jant şeridi" yazıp aramak isteyecektir, şu an sadece kategori/marka filtresiyle gezinebiliyor).
- Sepet/hesap/favori simgesi yok — bu, sitenin "e-ticaret sitesi" değil "katalog" hissi vermesine katkıda bulunuyor.
- Marka filtresi (Honda, Yamaha, KTM, BMW vb.) iyi düşünülmüş, motosiklet aksesuarı segmentinde doğru bir filtre.
- Footer'da yasal sayfalar (gizlilik, mesafeli satış) mevcut — bu iyi, ama "Hakkımızda" / "İletişim" sayfası eksik. Şu an marka güveni için sadece WhatsApp, Instagram ve e-posta linkleri var; kurumsal bilgi (adres, vergi no, işletme sahibi) hiçbir yerde görünmüyor — bu hem güven hem de Türkiye'deki e-ticaret mevzuatı (KVKK, mesafeli satış bilgilendirme) açısından eksik.
- Instagram linki `instagram.com/saprintpro` — hesabın aktif/dolu olup olmadığı ayrıca kontrol edilmeli; boş bir sosyal medya hesabına link vermek ters etki yapar.

---

## 7. Trendyol ile İlişki — Stratejik Değerlendirme

Bu, raporun en kritik stratejik bölümü çünkü iki kanal arasındaki ilişki hem büyük bir fırsat hem de gözden kaçırılırsa ciddi bir risk taşıyor.

### Fırsat tarafı

- Trendyol'da komisyon (kategoriye göre genelde %15-25 bandında) ödüyorsunuz; web sitesi üzerinden WhatsApp ile direkt satış bu komisyonu tamamen ortadan kaldırıyor. Ürün sayfasındaki "%20 indirimli" fiyatlama bu marjı müşteriyle paylaşma stratejisi — doğru bir yaklaşım.
- Trendyol'da biriken ürün kataloğu, görselleri ve satış geçmişi, sıfırdan bir e-ticaret sitesi kurmaktan çok daha hızlı bir başlangıç sağlamış.
- Web sitesi, Trendyol'un vitrin dışına çıkarak marka kimliği (SA Printpro adıyla anılma), doğrudan müşteri ilişkisi (e-posta/WhatsApp listesi) ve gelecekte kendi SEO trafiğini biriktirme imkânı veriyor — bunların hiçbiri Trendyol'da mümkün değil.

### Risk tarafı

- **Trendyol'un satıcı sözleşmesinde genelde müşterileri platform dışına yönlendirme (off-platform yönlendirme) yasaktır veya kısıtlıdır.** Trendyol içindeki bir ürünün açıklamasında, görselinde veya paketinde web sitesine/WhatsApp'a yönlendirme yapılırsa hesap askıya alma/kapatma riski doğar. Bu raporun kapsamı dışında olsa da, **Trendyol'daki mevcut ürün listelemelerinizde ve kargo paketlerinizde web sitesine veya WhatsApp'a doğrudan yönlendirme olup olmadığını mutlaka kontrol edin** — yönlendirme sadece bu bağımsız web sitesi üzerinden (Trendyol dışı kanallardan: Instagram, Google reklamı, mevcut müşteri tabanı) yapılmalı, Trendyol vitrini üzerinden değil.
- İki kanalda **fiyat tutarlılığı** önemli bir konu: web sitesinde "%20 indirimli" fiyat gösterip Trendyol'da tam fiyat satmak normalde sorun değil, ama aynı ürünün Trendyol'daki fiyatı web sitesinden daha yüksek görünürse bazı müşteriler bunu "kandırılma" olarak algılayabilir; şeffaf bir mesaj ("web sitesine özel fiyat, komisyonsuz satıştan doğan avantaj") faydalı olur — bu zaten "Doğrudan Siparişte" ifadesiyle kısmen yapılmış, iyi bir detay.
- **Stok senkronizasyonu:** Aynı ürün hem Trendyol'da hem web sitesinde satılıyorsa, iki kanaldan gelen siparişler manuel takip ediliyorsa stok tükenmesi/fazla satış riski var. Şu an web sitesindeki "20000 adet" gibi rakamlar muhtemelen gerçek stok değil, varsayılan/yüksek bir sayı — bu ileride gerçek dışı stok görüntüsü sorununa yol açabilir.
- **Marka karışıklığı:** Trendyol'daki mağaza adı ile "SA Printpro" marka adı birebir aynı mı? Değilse müşteri iki farklı yerden aynı ürünü gördüğünde kafası karışabilir; aynıysa bu tutarlılık bir avantaj.

### Önerilen konumlandırma

Web sitesi, Trendyol'un **yerini almak değil, tamamlamak** için var olmalı:

- Trendyol → geniş kitleye erişim, güven (platform güvencesi), yeni müşteri kazanımı.
- Web sitesi → mevcut/sadık müşterilere komisyonsuz kanal, marka kimliği, gelecekte kendi SEO/organik trafiğiyle Trendyol'a bağımlılığı azaltma.
- Trendyol paketlerine (kargo kutusu/poşetine) "Instagram'da bizi takip edin" gibi nötr, platform kurallarına aykırı olmayan bir marka hatırlatıcısı koyup, web sitesi linkini doğrudan yazmamak daha güvenli bir yol olabilir — bu konuyu Trendyol'un güncel satıcı sözleşmesinden teyit etmenizi öneririm.

---

## 8. Öncelik Sırasına Göre Aksiyon Listesi

**Hemen (1-2 hafta içinde):**

1. saprintpro.com domainini gerçekten yayına alın.
2. Mesafeli satış sözleşmesi ile ürün sayfası arasındaki tutarsızlığı giderin: ya Shopier linkini gerçekten ekleyin ya da sözleşme metnini "sadece WhatsApp üzerinden sipariş alınır" şeklinde güncelleyin.
3. Trendyol'un zorunlu uyum/uyarı metinlerini (ECE, ithalatçı bilgisi vb.) ürün açıklamalarından temizleyip kendi markanıza uygun, güven verici metinlerle değiştirin.
4. Trendyol'daki mevcut listelemelerde/paketlerde web sitesine yönlendirme olup olmadığını kontrol edin, sözleşmeyi gözden geçirin.

**Kısa vade (1 ay):**
5. Sitemap.xml oluşturup Search Console'a ekleyin, robots.txt kontrol edin.
6. Ürün arama kutusu ekleyin.
7. "Daha Fazla Göster" yerine gerçek sayfalama (statik/SSR) kurun.
8. Ürün görsellerini Trendyol CDN'inden kendi sunucunuza taşıyın.
9. "Hakkımızda" ve kurumsal bilgi (işletme adı, adres/iletişim, varsa vergi no) sayfası ekleyin.

**Orta vade (2-3 ay):**
10. Schema.org yapısal veri (Product/Offer) ekleyin.
11. Basit sepet + gerçek ödeme entegrasyonu (Shopier/iyzico/PayTR) kurun.
12. Ürün açıklamalarını tekilleştirin, şablon dilini azaltın (özellikle en çok satan/öne çıkan ürünlerden başlayarak, 235'inin hepsini aynı anda değil).
13. Tek ürünlü kategorileri gözden geçirin — birleştirin ya da kategori sayfasını zenginleştirin.

**Uzun vade:**
14. Trendyol'dan bağımsız SEO trafiği için içerik stratejisi (blog/rehber sayfaları: "motosiklet jant şeridi nasıl seçilir", "reflektif sticker bakımı" gibi).
15. E-posta/WhatsApp toplulukla (mevcut müşteri listesi) sadakat ve tekrar satın alma programı.
16. İki kanal arası stok ve fiyat senkronizasyonunu yarı-otomatik hale getirecek basit bir iç araç (mevcut geliştirme yetkinliğinizle kendi ihtiyacınıza göre kurulabilir).

---

## 9. Özet

Site, sıfırdan kurulmuş bir Astro/Cloudflare Workers vitrin sitesi olarak teknik temelde iyi durumda (hızlı, temiz kod tabanı, düzenli meta veri). Asıl zayıflık üç noktada toplanıyor: **(1)** domain/SEO altyapısının henüz tamamlanmamış olması, **(2)** vaat edilen ödeme akışı ile gerçek akış arasındaki tutarsızlık, **(3)** Trendyol'dan aktarılan içeriğin (metin + görsel + uyarı ifadeleri) olduğu gibi bırakılmış olması. Bunlar düzeltildiğinde site, Trendyol'u tamamlayan, komisyonsuz ve marka değeri biriktiren gerçek bir ikinci kanala dönüşebilir — ama şu anki haliyle hem tüketici güveni hem SEO potansiyeli açısından ilk izlenimini kaybediyor.



1. Ürün sayfasında özellik tablosu iki kez tekrarlanıyor

"Ürün Özellikleri" bölümü ile hemen altındaki "Teknik Özellikler ve Üretim Bilgileri" bölümü aynı alanları iki kez gösteriyor: ÖZELLİK: Diğer, KULLANIM TALİMATI/UYARILARI: temiz zemine uygulanmalıdır., MENŞEİ: TR — bu üç satır sayfada tam olarak iki kez, art arda görünüyor. Muhtemelen iki farklı bileşen (statik "teknik özellikler" bloğu + dinamik "ürün özellikleri" tablosu) aynı veriyi ayrı ayrı render ediyor. Kullanıcıya tekrarlı, özensiz görünüyor; ayrıca sayfa içinde aynı ifadenin tekrarı SEO açısından da (thin/duplicate content sinyali) ideal değil. Tek bir tabloya birleştirilmeli.

2. Fiyat bloğu kafa karıştırıcı şekilde aynı rakamı iki kez gösteriyor

Sayfada sırasıyla: "225 TL" → "Doğrudan Siparişte: 225 TL (%20 İndirimli)" → "Liste Fiyatı: 277 TL". Ana başlık fiyatı zaten 225 TL (indirimli fiyat) olduğu için, hemen altında "Doğrudan Siparişte: 225 TL" yazması gereksiz bir tekrar — kullanıcı "bu farklı bir fiyat mı?" diye tereddüt edebilir. Öneri: üstteki büyük fiyatı "277 TL" (üstü çizili, Trendyol/liste fiyatı) yanında tek bir "Web'e Özel Fiyat: 225 TL (%20 indirim)" şeklinde göstermek daha net olur.

3. "Marka: Oracal" alanı hâlâ kafa karıştırıyor

Bu, önceki raporda da değindiğim ama hâlâ düzelmemiş bir nokta: "Oracal" bir vinil/folyo hammadde markası, motosiklet markası değil. Ürün özellikleri tablosunda "MARKA: Oracal" yazması, sitenin "%100 Orijinal SA Printpro Üretimi, kendi atölyemizde üretilen" mesajıyla çelişiyormuş gibi okunabilir ("bu SA Printpro ürünü mü yoksa Oracal markalı bir ürün mü?"). Bu alan ya "Malzeme Markası: Oracal" gibi netleştirilmeli ya da müşteri karşısında gösterilmemeli.

4. Ürün açıklaması hâlâ ham veri gibi görünüyor

"Ürün Açıklaması" bölümü şu şekilde: "Honda Pcx Jant Şeridi, yerli üretim olup Türkiye'de üretilmiştir.; - Diğer kategorisinde yer alan bu ürün...; - Temiz zemine uygulanarak..." — cümleler arasında ";‑" gibi ham birleştirme karakterleri görünüyor. Bu, bir template'in madde işaretlerini (bullet point) düz metne çevirirken ayraç karakterini temizlemeyi unuttuğunu gösteriyor. Küçük ama görünürlüğü yüksek bir kusur — 235 ürünün tamamını etkiliyor olabilir.

5. "Varyant Seçimi" başlığı var ama seçenek yok

Sayfada "Varyant Seçimi" etiketi duruyor ama altında tıklanabilir bir seçenek/dropdown görünmüyor (en azından statik HTML'de). Ya bu ürünün gerçekten varyantı yok ve etiket boşuna render ediliyor (kaldırılmalı), ya da varyant seçici JS ile yükleniyor ve statik HTML'de hiç yok (bu durumda JS kapalıyken/yavaş bağlantıda kullanıcı hiç varyant göremez).

6. Ana sayfadaki "En çok tercih edilen 12 ürün" iddiası doğrulanabilir mi?

Ana sayfa artık "Öne Çıkan Ürünler — En çok tercih edilen 12 ürün" başlığı kullanıyor. Bu ifade gerçek satış/sipariş verisine mi dayanıyor, yoksa sabit/rastgele seçilmiş 12 ürün mü? WhatsApp tabanlı satışta sipariş verisi muhtemelen sistematik olarak toplanmıyor. Eğer bu liste gerçek popülerlik verisine dayanmıyorsa, ifadeyi "Öne Çıkan Ürünler" gibi nötr bir başlığa çevirmek daha doğru olur — aksi halde tüketiciyi yanıltıcı bir sosyal kanıt iddiası olur.

7. Artık gerçek bir e-ticaret sitesisiniz — Google Merchant Center fırsatı

Görselleriniz artık kendi sunucunuzda, ürün verisi (fiyat, stok, SKU, barkod) yapılandırılmış durumda ve domain gerçek. Bu, önceki raporda mümkün olmayan bir şeyi şimdi mümkün kılıyor: Google Merchant Center'a ürün feed'i verip Google Alışveriş'te (ücretsiz listeleme + isteğe bağlı Shopping Ads) görünebilirsiniz. Bu, Trendyol'dan bağımsız, tamamen yeni bir trafik kanalı olur ve şu anki altyapınızla (statik XML/JSON feed üretimi) nispeten düşük efor ister.

8. Trendyol ilişkisi açısından yeni bir nokta

Artık web sitesi gerçek anlamda canlı ve indekslenebilir durumda olduğu için, iki kanal arasında UTM/kaynak takibi kurmanızı öneririm: WhatsApp linklerine (?text=... zaten var, ama utm_source gibi bir parametre yok) ve Shopier linklerine kaynak etiketi ekleyin. Böylece hangi siparişlerin web sitesinden, hangilerinin Trendyol'dan geldiğini ayırt edebilir, komisyonsuz kanalın gerçek büyüme hızını ölçebilirsiniz — şu an muhtemelen bu ayrım tamamen manuel/tahmini. En kritik: Site HTTPS'e yönlendirmiyor

Test http://saprintpro.com/ üzerinden çalıştırılmış ve site bunu HTTPS'e otomatik yönlendirmemiş — sayfa düz HTTP üzerinden tamamen yüklenmiş (33 "insecure request", redirects-http denetimi 0 puan). Ayrıca:

HSTS header'ı yok
CSP (Content Security Policy) yok
COOP header'ı yok

Bu, Best Practices puanını 0.70'e düşüren ana sebep. Cloudflare'de custom domain'i eklediniz ama "Always Use HTTPS" ayarı muhtemelen kapalı. Cloudflare panelinde SSL/TLS → Edge Certificates → Always Use HTTPS'i açmanız yeterli olur — bu hem güvenlik hem de HTTP/2 kullanımı (şu an tüm istekler eski http/1.1 üzerinden gidiyor, bu da ~220ms kaybettiriyor) açısından tek seferde iki sorunu çözer.

🟡 Fiyat ve rozet renkleri kontrast standardını karşılamıyor (WCAG)

Bu, tek bir ürüne özgü değil, sitedeki her ürün kartını etkileyen global bir tasarım sorunu:

Fiyat rakamları (text-emerald-600 yeşili, beyaz zemin üzerinde): kontrast oranı 3.76 — gereken 4.5
"%20 İndirimli" rozetindeki beyaz yazı (yeşil zemin üzerinde): aynı şekilde 3.76
Kategori/marka sayılarındaki gri rakamlar (text-zinc-400): kontrast oranı 2.56 — çok düşük
Üstü çizili liste fiyatı metni: aynı gri ton, aynı sorun

Bu üç rengi biraz koyulaştırmanız (örn. emerald-600 yerine emerald-700, zinc-400 yerine zinc-500/600) hem görme zorluğu yaşayan kullanıcılar için hem de erişilebilirlik denetimleri için düzelir — CSS'te birkaç değişken değişikliği, tüm siteye yayılır.

🟡 LCP görseli yanlış önceliklendiriliyor

En büyük görsel öğe (Suzuki ürün görseli) loading="lazy" ile işaretlenmiş ve fetchpriority="high" verilmemiş — bu, LCP'yi (3.5s) gereksiz yere geciktiriyor. Ana sayfadaki ilk ekranda görünen ürün görsellerine lazy-load uygulanmamalı, ilk 2-4 ürün görseli eager+high-priority olmalı.

🟡 Görseller gereğinden büyük boyutta sunuluyor (~275 KB tasarruf potansiyeli)
logo.png: 800×339 boyutunda ama ekranda 130×55 gösteriliyor → ~173 KB gereksiz
Ürün görselleri: 533×665 boyutunda üretilip 276×414 gösteriliyor → her biri 10-45 KB gereksiz

Görsel işleme adımınıza (muhtemelen process-images.mjs) gerçek gösterim boyutuna göre responsive/optimize boyut üretmeyi eklemeniz gerekiyor.

🟢 Bu arada doğrulanan bir şey daha

Lighthouse'un ham HTML çıktısında hâlâ "Suzuki Gsx1300r Hayabusa Granaj SA Printpro Etiket Siyah" gibi bozuk başlıklar görünüyor — yani önceki turda bulduğum "sticker → SA Printpro" hatası bu anlık görüntüde de hâlâ düzeltilmemiş.

Öncelik sırası: (1) Cloudflare'de Always Use HTTPS'i açın — 2 dakikalık iş, hem güvenlik hem hız kazandırır; (2) fiyat/rozet/gri metin renklerini kontrast standardına göre koyulaştırın; (3) LCP görselini lazy-load'dan çıkarıp öncelik verin; (4) görsel boyutlarını gerçek gösterim ölçüsüne göre küçültün.



# SA PRINTPRO — FAZ 3 MASTER PROMPT (Veri Kalitesi, Görsel Bağımlılığı, Checkout Netliği)

Canlı site (saprintpro.com) detaylı incelendi. Faz 1 ve Faz 2'deki yasal sayfalar, çerez banner'ı, WhatsApp butonu, kurumsal bilgi alanı başarıyla uygulanmış. Ama inceleme sırasında yeni, daha derin sorunlar ortaya çıktı. Bunları önem sırasına göre işle.

---

## 🔴 ÖNCELİK 1 — Checkout Akışını Netleştir ve Tek Bir Yola Bağla

**Sorun:** Ürün sayfasında (`/urun/...`) görünen satın alma CTA'ları **"İndirimli Sipariş Ver (WhatsApp)"** ve **"Sepete Ekle"** — Shopier'e giden bir buton yok. Ama önceki deploy raporunda "SHOPIER_CLIENT_ID/SECRET Worker'a eklendi, `/shopier/oauth/callback` çalışıyor" denmişti. Bu ikisi tutarsız görünüyor.

**Yapılacak:**

1. Şu anki gerçek durumu raporla: `/sepet` sayfasına gidildiğinde (bu sayfa robots.txt ile crawl'a kapalı, dışarıdan göremedik) checkout adımında gerçekten Shopier ödeme ekranına mı düşülüyor, yoksa oradan da WhatsApp'a mı yönleniyor?
2. **Tek bir nihai satış akışına karar ver ve HER YERDE tutarlı uygula:**
   - Seçenek A: Shopier tam entegre → ürün sayfasındaki "İndirimli Sipariş Ver (WhatsApp)" butonu kaldırılır veya ikincil/alternatif seçenek olarak küçük tutulur, ana CTA "Satın Al (Shopier)" olur.
   - Seçenek B: WhatsApp manuel sipariş ana model olacaksa, Shopier altyapısını (OAuth secret'ları, callback endpoint'i) kaldır veya en azından "kullanılmıyor" olarak işaretle — boşta duran, yanlış izlenim veren bir entegrasyon bırakma.
3. Fiyat gösterimindeki "225 TL — Doğrudan Siparişte: 225 TL (%20 İndirimli) — Liste Fiyatı: 277 TL" ifadesini sadeleştir; "doğrudan sipariş" ile normal sipariş arasındaki fark neyse (varsa) net açıkla, yoksa kaldır.

---

## 🔴 ÖNCELİK 2 — Tüm Ürün Görsellerini Kendi Sunucunda Barındır

**Sorun:** Sadece Motosiklet Jant Şerit kategorisindeki (~68 ürün) görseller `/uploads/products/` altında yerel olarak barınıyor. Geri kalan ~167 ürün (Arma Sticker & Fosfor Şerit, Duvar & Dekorasyon, Ofis, Reflektör, Tankpad & Sticker kategorileri) görselleri hâlâ doğrudan `cdn.dsmcdn.com` (Trendyol'un CDN'i) üzerinden hotlink ediliyor.

**Risk:** Trendyol istediği an hotlinking'i engelleyebilir (referrer kontrolü ile) — o an 167 ürünün görseli aynı anda, senin haberin olmadan kırılır. Ayrıca sayfa hızı da başka bir platformun sunucusuna bağımlı kalıyor.

**Yapılacak:**

1. Kalan tüm ürünlerin görsellerini indirip `/uploads/products/` altına taşı (aynı jant şeridi kategorisinde yapılan işlemin aynısı).
2. Hiçbir sayfa/şablonda `cdn.dsmcdn.com` veya başka bir harici görsel URL'i kalmadığını doğrula (site genelinde grep ile kontrol et).
3. Görsel boyutlarını/formatını (webp, uygun çözünürlük) standartlaştır, mevcut jant şeridi görselleriyle tutarlı olsun.

---

## 🟡 ÖNCELİK 3 — Yinelenen (Duplicate) Ürünleri Birleştir

**Sorun:** Aynı ürün, farklı ürün ID'leriyle birden fazla kez listelenmiş — muhtemelen Trendyol'daki renk/beden varyantları ayrı ürün olarak import edilmiş. Örnekler:

- "Limited Edıtıon sticker otomobil araba etiket..." → 2 farklı ID
- "Araba Makyaj Ayna Etiket Sticker, Bugünde Çok Güzelsin" → 2 farklı ID
- "Ktm Motosikletiniz İçin Yüksek Kaliteli Sticker Seti..." → 3 farklı ID

**Yapılacak:**

1. Tüm katalogda isim benzerliği + görsel benzerliğine göre olası duplicate/varyant gruplarını tespit et (script ile: benzer başlık, aynı fiyat aralığı, farklı ID).
2. Gerçekten aynı ürünün varyantlarıysa (örn. sadece renk farkı), bunları **tek ürün sayfası + varyant seçici** (orijinal master promptta planlanan renk/beden seçim mekanizması) altında birleştir.
3. Gerçekten farklı ürünlerse (görünüşe rağmen), her birinin başlığını/açıklamasını netleştir ki müşteri farkı anlasın.
4. Birleştirme sonrası eski URL'lerden yeni birleşik ürün sayfasına 301 yönlendirme koy (SEO kaybı olmasın).

---

## 🟡 ÖNCELİK 4 — Kategori Taksonomisini Düzelt

**Sorun:** "Arma Sticker & Fosfor Şerit" kategorisi (141 ürün) içinde duvar dekoru, araba çıkartması, motosiklet sticker'ı, dini hat yazısı, ayna sticker'ı gibi birbiriyle alakasız ürünler karışık halde duruyor — muhtemelen Trendyol'un "diğer/genel" kategorisi olduğu gibi buraya aktarılmış.

**Yapılacak:**

1. Bu kategorideki 141 ürünü gerçek içeriklerine göre yeniden sınıflandır (gerekirse yeni alt kategoriler aç: Duvar Sticker, Araba Aksesuar, Dini/Kaligrafi Sticker, Motosiklet Sticker vb.).
2. Kategori adlarının, içindeki ürünlerle örtüştüğünden emin ol.
3. "Motosiklet Markanı Seç" filtresini sadece motosiklet ürünü içeren kategorilerde göster — alakasız kategorilerde (Duvar & Dekorasyon gibi) bu filtre kaldırılmalı.

---

## 🟢 ÖNCELİK 5 — Ürün Açıklaması & FAQ Kalitesi

**Sorun:** Ürün açıklamaları şablonik görünüyor ("Diğer kategorisinde yer alan bu ürün, motosikletiniz için özel bir aksesuar olarak tasarlanmıştır" gibi genel cümleler, noktalı virgülle bölünmüş). FAQ bölümü de muhtemelen tüm ürünlerde birebir aynı.

**Yapılacak:**

1. Örnek olarak 5-10 farklı üründe açıklama ve FAQ metinlerini karşılaştır — gerçekten birebir aynıysa bu bir duplicate content sorunu.
2. Mümkünse her ürün için en az ürüne özgü 1-2 cümle (ürün adı, uyumlu model, kategoriye özel detay) otomatik şablona enjekte edilsin ki sayfalar birbirinden ayrışsın.
3. "MARKA: Oracal" gibi yanlış eşlenmiş alanları kontrol et (Oracal bir motosiklet markası değil, vinil malzeme markası) — marka filtresi bu tür hatalı verilerle güvenilirliğini kaybetmesin.

---

## AGENT İÇİN TALİMAT

Önceliklere göre sırayla ilerle (1 → 5). Her madde tamamlandığında canlıda doğrula ve önceki raporlardaki gibi bir doğrulama tablosu üret. Özellikle Öncelik 1'de (checkout netliği) agent'ın kendi başına "hangisini seçeceğine" karar vermemesi, kullanıcıya (siteni işleten kişiye) hangi modelin (Shopier otomatik ödeme mi, WhatsApp manuel sipariş mi) tercih edildiğini SORMASI gerekiyor — bu ticari bir karar, teknik bir detay değil.a
