# Utstyrsstyring - Startup / Shutdown

Kjor kommandoene fra repo-roten:
`c:\Users\holak\Prosjekter\utstyrsstyring`

## Startup (web + api + db)

```powershell
docker compose up -d
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter api start:dev'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter web dev'
```

Sider:
- Web: http://localhost:3000
- API: http://localhost:3001

## Full lokal HTTPS (for mobilkamera)

Malkjede:
- Next dev: `http://localhost:3000`
- API dev: `http://localhost:3001`
- Caddy HTTPS proxy: `https://<LAN_HOST>` (TLS + proxy for web og `/api`)

### 1) Sett LAN-host i repo-root `.env`

```env
LAN_HOST=192.168.10.123
SESSION_COOKIE_SECURE=true
```

Bruk faktisk IPv4-adresse til PC-en din.

### 2) Start tjenester

```powershell
docker compose up -d
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter api start:dev'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter web dev'
```

### 3) Eksporter lokal CA fra Caddy og installer på mobil

Kopier CA fra container:
```powershell
docker cp utstyr_https:/data/caddy/pki/authorities/local/root.crt .\caddy-root.crt
```

Installer og stol pa sertifikatet på mobilen:
- iOS: installer profil + aktiver full trust under `Settings > General > About > Certificate Trust Settings`.
- Android: installer som CA-sertifikat i sikkerhetsinnstillinger.

### 4) Bruk HTTPS-url på mobil

- `https://<LAN_HOST>/login`
- `https://<LAN_HOST>/scan`

Merk:
- Frontend bruker automatisk `/api` over samme HTTPS-origin.
- Hvis kamera fortsatt blokkeres, sjekk at url faktisk starter med `https://`.

## Tunnel mode (ingen installasjon pa mobil)

Bruk dette hvis du ikke vil installere lokal CA/sertifikat på mobilen.
Da får du en offentlig `https://...` URL med gyldig sertifikat.

### Restart før tunnel-test

1. Sett root `.env`:
```env
LAN_HOST=192.168.10.103
SESSION_COOKIE_SECURE=true
```

2. Restart tjenester:
```powershell
docker compose up -d --force-recreate https
docker compose up -d db

Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { taskkill /PID $_ /F }

Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter api start:dev'
Start-Process powershell -ArgumentList '-NoExit','-Command','cd "c:\Users\holak\Prosjekter\utstyrsstyring"; pnpm --filter web dev'
```

### Start tunnel (Cloudflare, raskest)

```powershell
docker run --rm cloudflare/cloudflared:latest tunnel --no-autoupdate --url http://host.docker.internal:3000
```

Cloudflared skriver ut en URL som ligner:
- `https://xxxxx.trycloudflare.com`

Bruk denne på mobil:
- `https://xxxxx.trycloudflare.com/login`
- `https://xxxxx.trycloudflare.com/scan`

Merk:
- Tunnel mode bruker Next.js rewrite `/api/* -> http://localhost:3001/*`.
- Dette unngår redirect-loop gjennom lokal HTTPS-proxy.

## Shutdown (web + api + db)

```powershell
Get-NetTCPConnection -LocalPort 3000,3001 -State Listen -ErrorAction SilentlyContinue |
  Select-Object -ExpandProperty OwningProcess -Unique |
  ForEach-Object { taskkill /PID $_ /F }

docker compose down
```

## Rask helsesjekk

```powershell
try { (Invoke-WebRequest -Uri 'http://localhost:3000/' -UseBasicParsing -TimeoutSec 10).StatusCode } catch { "WEB ERR: $($_.Exception.Message)" }
try { (Invoke-WebRequest -Uri 'http://localhost:3001/' -UseBasicParsing -TimeoutSec 10).StatusCode } catch { "API ERR: $($_.Exception.Message)" }
```

## Backlog: mobilscanning (pilot senere)

### Gjøremål

- [ ] Pilot: live strekkodeskanning på mobil i nettleser, og koble resultat til eksisterende gjenstand (asset).
- [ ] Lagre skannet kode i `Asset.barcode` (når backend-feltet er på plass).
- [ ] Legg til enkel "Skann strekkode"-knapp på gjenstandsside (`/assets/[id]`), mobil først.
- [ ] Valider at samme kode ikke kan knyttes til flere gjenstander.

### Verktøy undersøkt (for live deteksjon av qr kod)

1. Native `BarcodeDetector` API (web)
- Fordel: null ekstra bibliotek, rask å teste.
- Ulempe: eksperimentell/varierende browser-støtte, krever HTTPS på mobil.
- Passer til: rask PoC med fallback.

2. `@zxing/browser` (open source)
- Fordel: moden OSS-løsning for 1D/2D i browser, aktivt brukt.
- Ulempe: mer tuning nødvendig på krevende etiketter/lysforhold.
- Passer til: default kandidat for pilot i dette prosjektet.

3. `@ericblade/quagga2` (open source)
- Fordel: spesielt brukt for live 1D-scanning i video.
- Ulempe: krever mer konfigurasjon/tuning enn ferdige kommersielle SDK-er.
- Passer til: alternativ hvis vi primært skanner 1D-koder (EAN/Code128).

4. Scandit Web SDK (kommersiell)
- Fordel: høy ytelse, ferdige workflows, god dokumentasjon/samples.
- Ulempe: lisenskostnad.
- Passer til: produksjon i krevende miljø (lager, dårlig lys, batch).

5. Dynamsoft JavaScript SDK (kommersiell)
- Fordel: sterk ytelse og bred symbology-støtte for web.
- Ulempe: lisenskostnad.
- Passer til: produksjon der robusthet er viktigere enn OSS-only.

6. Google ML Kit (native Android/iOS)
- Fordel: svært god native mobilopplevelse.
- Ulempe: krever native app (ikke ren webstack).
- Passer til: fase 2 hvis vi lager dedikert mobilapp.

### Anbefalt pilotspor (når vi tar dette)

1. Start med `@zxing/browser` i webappen (mobil web, bak kamera-knapp).
2. Legg til runtime-fallback til `BarcodeDetector` der tilgjengelig.
3. Mål tre KPI-er: tid til første treff, treffrate i lavt lys, feilskanning per 100 skann.
4. Hvis kvaliteten ikke holder: evaluer Scandit/Dynamsoft i en 1-ukes spike.
