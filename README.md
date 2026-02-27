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
- Login: http://localhost:3000/login

## Innlogging (ny)

Systemet bruker nå session-cookie med brukernavn/passord.

Standard på eksisterende DB (etter migrering):
- Admin: `admin001` / `changeme123`

Etter `POST /seed` opprettes også:
- Admin PC: `adminpc` / `${SEED_ADMIN_PASSWORD:-admin123}`
- Admin Mobil: `adminmobile` / `${SEED_ADMIN_PASSWORD:-admin123}`
- User 1: `user1` / `${SEED_USER_PASSWORD:-user123}`
- User 2: `user2` / `${SEED_USER_PASSWORD:-user123}`

Tips:
- Logg inn som `adminmobile` på telefon og `adminpc` på PC for to separate admin-sesjoner.

## LAN-oppsett (PC som host, test på mobil)

For LAN i dev bruker prosjektet:
- Web på `0.0.0.0:3000`
- API på `0.0.0.0:${API_PORT:-3001}`

Anbefalte env-verdier i `apps/api/.env`:

```env
API_PORT=3001
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000,http://<DIN-LAN-IP>:3000
```

Slik tester du fra mobil:
1. Finn PC-IP med `ipconfig` (IPv4).
2. Start web + api + db.
3. Åpne `http://<DIN-LAN-IP>:3000` på mobil (samme Wi-Fi).
4. Hvis siden ikke åpner: åpne Windows Firewall for TCP `3000` og `3001`.

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

## Pilot: mobilskanning (ny)

Skanneside:
- Web: `http://localhost:3000/scan`

Hva den gjør nå:
- Starter mobilkamera og bruker ZXing som primær live-deteksjon (fallback til native `BarcodeDetector`).
- Slår opp kode i API via `POST /scan/lookup`.
- Lar deg knytte koden til valgt gjenstand via `PATCH /assets/:id` (lagres i `barcode`).
- Hver gjenstandsside (`/assets/[id]`) viser nå synlig scannbar strekkode for test.

### Test på mobil i LAN

1. Start web/API som vanlig.
2. Finn PC-IP i lokalnettet:
```powershell
ipconfig
```
3. Åpne på mobil (samme Wi-Fi):
- `http://<DIN-LAN-IP>:3000/scan`
4. Gi kameratillatelse i nettleseren.

Tips:
- Chrome på mobil har best støtte for denne piloten.
- Hvis live deteksjon ikke er tilgjengelig i nettleseren, bruk manuell kode-input på samme side.
- For rask test: åpne en gjenstand på PC, vis strekkoden på skjermen, og skann den fra mobil.

## Backlog: mobilscanning (pilot senere)

### Gjøremål

- [ ] Pilot: live strekkodeskanning på mobil i nettleser, og koble resultat til eksisterende gjenstand (asset).
- [ ] Lagre skannet kode i `Asset.barcode` (når backend-feltet er på plass).
- [ ] Legg til enkel "Skann strekkode"-knapp på gjenstandsside (`/assets/[id]`), mobil først.
- [ ] Valider at samme kode ikke kan knyttes til flere gjenstander.

### Verktøy undersøkt (for live deteksjon)

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
