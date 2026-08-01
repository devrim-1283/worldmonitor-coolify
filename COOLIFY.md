# Coolify Deployment Runbook

Bu fork'un Coolify'a kurulum rehberi. Upstream'in `SELF_HOSTING.md` dosyası
Docker/Podman'i bir geliştirme makinesinde çalıştırmayı anlatır; burada anlatılan
ise Coolify üzerinde kalıcı, tek sunuculu bir kurulum.

## Stack

| Servis | Ne yapar | Port | Dışarı açık mı |
|---|---|---|---|
| `worldmonitor` | nginx (statik SPA) + Node API sidecar, supervisord altında | 8080 | ✅ Traefik üzerinden |
| `ais-relay` | AISStream/OpenSky WebSocket ingest + kendi seed döngüleri | 3004 | ❌ sadece internal |
| `seeder` | 163 `scripts/seed-*.mjs` dosyasını periyodik çalıştırır | — | ❌ |
| `redis-rest` | Upstash uyumlu REST cephesi (SRH proxy) | 80 | ❌ |
| `redis` | Veri deposu, AOF persistence + named volume | 6379 | ❌ |

Hiçbir servis host portu publish etmez. Sadece `worldmonitor:8080` Coolify'ın
reverse proxy'si üzerinden alan adına bağlanır.

## Kurulum

### 1. Coolify'da kaynağı oluştur

- **New Resource → Docker Compose**
- Repository: bu fork, branch `main`
- **Docker Compose Location:** `docker-compose.coolify.yml`
- Build Pack: `Docker Compose`

### 2. Zorunlu secret'ları üret

Üçünü de **ayrı ayrı** üret — birini iki değişkende kullanma:

```bash
openssl rand -hex 32   # REDIS_PASSWORD
openssl rand -hex 32   # REDIS_TOKEN
openssl rand -hex 32   # RELAY_SHARED_SECRET
```

Bu üçü olmadan compose doğrulaması `:?` guard'larında patlar — stack hiç
başlamaz. `ais-relay` ayrıca `RELAY_SHARED_SECRET` boşsa boot'ta `exit(1)` yapar.

⚠️ **Coolify'ın otomatik doldurduğu değerleri kontrol et.** Coolify compose
dosyasını tarayıp env listesini kendisi oluşturuyor ve `${VAR:?mesaj}`
yazımındaki *mesajı varsayılan değer sanıyor*. Bu yüzden compose'daki guard'lar
mesajsız (`${VAR:?}`) bırakıldı — ama Coolify daha önce bir değer yaratmışsa
env sekmesinde duruyor olabilir. Deploy öncesi üç secret'ın da gerçekten senin
ürettiğin 64 karakterlik hex olduğunu gözle doğrula.

### 3. Environment variable'ları gir

`.env.coolify.example` içeriğini Coolify'ın **Environment Variables** sekmesine
yapıştır, placeholder'ları kendi değerlerinle değiştir.

`VITE_` ile başlayan değişkenleri **Build Variable** olarak da işaretle. Vite bu
değerleri build sırasında bundle'a gömer; container'a runtime env olarak
vermenin hiçbir etkisi olmaz. Değiştirdiğinde **Redeploy** (rebuild) gerekir,
restart yetmez.

### 4. Domain ata

Coolify UI'da `worldmonitor` servisi için domain gir (port `8080`).

Alternatif olarak compose'daki `SERVICE_FQDN_WORLDMONITOR_8080` satırının
yorumunu kaldırırsan Coolify otomatik bir alan adı üretir. **İkisini aynı anda
yapma** — çakışan Traefik label'ları oluşur.

### 5. Deploy

İlk build 10–20 dakika sürer (deck.gl, onnxruntime, maplibre + 3 ayrı imaj).

## Deploy sonrası: veri ne zaman gelir

Dashboard açılır açılmaz panellerin boş olması **normaldir**. Veri Redis'ten
okunur, Redis'i de `seeder` servisi doldurur:

- İlk tam geçiş 163 seeder için **20–40 dakika** sürebilir.
- Sonrasında `SEED_INTERVAL_MINUTES` (varsayılan 30) periyoduyla tekrarlar.
- İlerlemeyi izle: Coolify → `seeder` → Logs. Her seeder için `OK` / `SKIP` /
  `FAIL` satırı basar. API key'i olmayan kaynaklar `SKIP` verir; bu bir hata
  değildir.

`redis` servisi AOF persistence ile çalışır, yani redeploy sonrası cache sıcak
kalır. `docker compose down -v` ya da Coolify'da volume silme sonrası ilk geçişi
yeniden beklemen gerekir.

## Doğrulama

```bash
curl -sf https://senin-domainin/api/sidecar-health
```

Bu route nginx'in `/api/` proxy'si üzerinden Node sidecar'a gider; 200 dönüyorsa
her iki process de ayakta demektir.

Veri sağlığı için `/api/health` JSON bir snapshot döner (`status`, `summary`,
`problems`); `?compact=1` dashboard'un 5 dakikada bir çektiği hafif sürümdür.
Dashboard'daki `N/55 OK` sayacı bu snapshot'tan üretilir.

## Sık karşılaşılan sorunlar

| Belirti | Sebep / çözüm |
|---|---|
| Stack hiç başlamıyor, compose hatası | Üç zorunlu secret'tan biri boş |
| `redis-rest` unhealthy, logunda `Connected to Redis` **var** | Secret'ın değerinde satır sonu/boşluk var. Probe `ERR_INVALID_CHAR: Invalid character in header content ["authorization"]` verir. Coolify'ın env alanına yapıştırırken sona `\n` kaçmıştır — değeri temizleyip yeniden gir. Aynı bozuk değer `UPSTASH_REDIS_REST_TOKEN` olarak uygulamaya da gittiği için sadece healthcheck'i değil tüm Redis çağrılarını bozar. Teşhis: `docker exec <container> node -e "const t=process.env.SRH_TOKEN\|\|'';console.log(t.length, JSON.stringify(t.replace(/[\x21-\x7e]/g,'')))"` — ikinci alan `\"\"` değilse sebep budur |
| `ais-relay` restart loop'ta | `RELAY_SHARED_SECRET` app'e verilmiş ama relay'e verilmemiş — compose ikisine de veriyor, Coolify'da değişkenin scope'unu kontrol et |
| Tüm paneller boş, `0/55 OK` | `seeder` henüz ilk geçişini bitirmedi ya da servis hiç ayağa kalkmadı |
| `seeder` unhealthy | Bir geçiş iki interval'dan uzun sürdü. `SEED_TIMEOUT`'u düşür ya da `SEED_INTERVAL_MINUTES`'ı yükselt |
| Harita açılmıyor | `VITE_PMTILES_URL` yanlış. Boş bırakırsan ücretsiz OpenFreeMap tile'larına düşer |
| Yanlış variant açılıyor | `VITE_VARIANT` Build Variable olarak işaretlenmemiş — rebuild gerekir |
| Redis OOM-kill | `REDIS_MAXMEMORY` ile `WM_REDIS_MEMORY` birbirine çok yakın. AOF rewrite buffer'ı için üstte pay bırak |

## Kaynak gereksinimi

Varsayılan limitler 4 vCPU / 8 GB bir node içindir:

| Servis | CPU | RAM |
|---|---|---|
| worldmonitor | 2.0 | 1 GB |
| ais-relay | 1.5 | 2 GB |
| seeder | 2.0 | 2 GB |
| redis | 1.0 | 1 GB |
| redis-rest | 0.5 | 256 MB |

Hepsi `.env.coolify.example` içindeki `WM_*` değişkenleriyle ayarlanabilir.
Daha küçük bir sunucuda önce `seeder` ve `ais-relay` limitlerini kıs — ikisi de
burst'lü, uzun süre boşta duran iş yükleri.

## Upstream ile senkron kalmak

```bash
git remote add upstream https://github.com/koala73/worldmonitor.git
git fetch upstream main
git rebase upstream/main    # bu fork'un tek katmanı Coolify dosyaları
```

Fork'a özgü dosyalar sadece şunlar — çakışma bunların dışına çıkmamalı:

- `docker-compose.coolify.yml`
- `Dockerfile.seeder`
- `docker/seeder-loop.sh`, `docker/seeder-healthcheck.sh`
- `.env.coolify.example`
- `COOLIFY.md`, `CLAUDE.md`
- `Dockerfile` içindeki `VITE_*` build-arg bloğu
- `.dockerignore` içindeki `**/node_modules` satırı
