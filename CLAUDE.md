# CLAUDE.md — worldmonitor-coolify fork

Bu dosya bu fork'a özgüdür. Projenin kendi mimari dokümantasyonu için önce
[AGENTS.md](AGENTS.md) oku — repository map, servis sınırları ve kod
konvansiyonları orada.

## Bu fork ne?

`koala73/worldmonitor` upstream'inin Coolify'a deploy edilen kopyası. Tek
katmanı deployment dosyaları; uygulama kodu upstream ile birebir aynı tutulur.

Fork'a ait dosyalar:

- `docker-compose.coolify.yml` — Coolify stack'i (app + relay + seeder + redis + redis-rest)
- `Dockerfile.seeder`, `docker/seeder-loop.sh`, `docker/seeder-healthcheck.sh`
- `.env.coolify.example`
- `COOLIFY.md` — deploy runbook
- `Dockerfile` içindeki `VITE_*` build-arg bloğu
- `.dockerignore` içindeki `**/node_modules` satırı
- bu dosya

Bunların dışında bir dosyayı değiştirmeden önce dur: upstream ile senkron
kalmayı zorlaştırır. Değişiklik gerçekten gerekliyse önce upstream'e PR açmak
doğru yol.

## KRİTİK: Git branch kuralları

**Kullanıcının açık izni olmadan farklı bir branch'e merge veya push YAPMA.**

- `beta`'daysan sadece `beta`'ya push et — sormadan `main`'e merge etme
- `main`'deysen `main`'de kal — sormadan branch değiştirip push etme
- Açıkça istenmedikçe branch merge etme
- Commit sonrası MEVCUT branch'e push etmek, işin devamıysa sorun değil

## Upstream senkronizasyonu

```bash
git fetch upstream main
git rebase upstream/main
```

`upstream` remote'u: `https://github.com/koala73/worldmonitor.git`

## Deployment

Runbook: [COOLIFY.md](COOLIFY.md). Kısa versiyon:

- Coolify → Docker Compose → compose dosyası `docker-compose.coolify.yml`
- Zorunlu üç secret: `REDIS_PASSWORD`, `REDIS_TOKEN`, `RELAY_SHARED_SECRET`
- `VITE_*` değişkenleri **build variable** olarak işaretlenmeli — Vite bunları
  bundle'a gömer, runtime env olarak vermenin etkisi yok
- Veriyi `seeder` servisi doldurur. Yoksa dashboard açılır ama tüm paneller boş

## Bash kuralları

Çıktı buffer'lanma sorunlarına yol açtığı için komut çıktısını `head`, `tail`,
`less`, `more` üzerinden borulama. Çıktıyı kısıtlaman gerekiyorsa komuta özgü
flag kullan (`git log -n 10` gibi).
