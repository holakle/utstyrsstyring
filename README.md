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
