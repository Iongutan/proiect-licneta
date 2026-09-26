# ═══════════════════════════════════════════════════════════════════════════
# OptiFleet — pornire / oprire / backup pe Windows (PowerShell, fără bash)
#
#   .\infra\local\optifleet.ps1 start     baza de date + aplicația, deschide browserul
#   .\infra\local\optifleet.ps1 stop      oprește tot (datele rămân)
#   .\infra\local\optifleet.ps1 backup    copie a bazei de date în infra\local\backups
#   .\infra\local\optifleet.ps1 status    ce rulează
#
# Prima instalare se face o singură dată cu:  bash infra/local/setup.sh --demo  (din Git Bash)
# ═══════════════════════════════════════════════════════════════════════════
param([ValidateSet("start", "stop", "backup", "status")][string]$Action = "start")

$ErrorActionPreference = "Stop"
$Here = $PSScriptRoot
$Root = (Resolve-Path (Join-Path $Here "..\..")).Path
$Stack = Join-Path $Here "supabase"

function Info($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }

# Docker scrie progresul pe stderr; PowerShell 5 l-ar trata ca eroare. Contează doar codul de ieșire.
function Invoke-Docker([string[]]$DockerArgs) {
    $prev = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    try { & docker @DockerArgs 2>&1 | Out-Null } finally { $ErrorActionPreference = $prev }
    if ($LASTEXITCODE -ne 0) { throw "docker $($DockerArgs -join ' ') a eșuat (cod $LASTEXITCODE)." }
}

function Test-Docker {
    docker info *> $null
    return $LASTEXITCODE -eq 0
}

function Start-DockerDesktop {
    if (Test-Docker) { return }
    $candidates = @(
        "$env:LOCALAPPDATA\Programs\DockerDesktop\Docker Desktop.exe",
        "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
    )
    $exe = $candidates | Where-Object { Test-Path $_ } | Select-Object -First 1
    if (-not $exe) { throw "Docker Desktop nu e instalat." }
    Info "Pornesc Docker Desktop…"
    Start-Process $exe | Out-Null
    for ($i = 0; $i -lt 90; $i++) {
        Start-Sleep -Seconds 2
        if (Test-Docker) { return }
    }
    throw "Docker Desktop nu a pornit în 3 minute."
}

if (-not (Test-Path (Join-Path $Stack "docker-compose.yml"))) {
    throw "Baza locală nu e instalată. Rulează o dată, din Git Bash:  bash infra/local/setup.sh --demo"
}

switch ($Action) {
    "start" {
        Start-DockerDesktop
        Info "Pornesc baza de date locală…"
        Push-Location $Stack
        try { Invoke-Docker @("compose", "up", "-d", "--quiet-pull") } finally { Pop-Location }

        Info "Aștept serviciile…"
        for ($i = 0; $i -lt 90; $i++) {
            try {
                Invoke-WebRequest -UseBasicParsing -TimeoutSec 3 "http://127.0.0.1:8000/auth/v1/health" `
                    -Headers @{ apikey = ((Get-Content (Join-Path $Stack ".env") | Where-Object { $_ -like "SUPABASE_PUBLISHABLE_KEY=*" }) -replace "^[^=]+=", "") } | Out-Null
                break
            } catch { Start-Sleep -Seconds 2 }
        }

        $appUp = $false
        try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:3000/login" | Out-Null; $appUp = $true } catch { }
        if (-not $appUp) {
            Info "Pornesc aplicația (se deschide o fereastră separată; închiderea ei oprește aplicația)…"
            Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$Root\frontend'; `$host.UI.RawUI.WindowTitle='OptiFleet – aplicația'; npm run dev"
            for ($i = 0; $i -lt 60; $i++) {
                Start-Sleep -Seconds 2
                try { Invoke-WebRequest -UseBasicParsing -TimeoutSec 2 "http://localhost:3000/login" | Out-Null; break } catch { }
            }
        }
        Start-Process "http://localhost:3000"
        Write-Host ""
        Write-Host "  Aplicația:          http://localhost:3000"
        Write-Host "  Baza de date (web): http://localhost:8000   (utilizator/parolă în infra\local\.credentials)"
        Write-Host "  Baza de date (pgAdmin/DBeaver): 127.0.0.1:5432, detalii în infra\local\.credentials"
    }
    "stop" {
        if (Test-Docker) {
            Push-Location $Stack
            try { Invoke-Docker @("compose", "stop") } finally { Pop-Location }
        }
        Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue |
            ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }
        Info "Oprit. Datele rămân salvate."
    }
    "backup" {
        Start-DockerDesktop
        $dir = Join-Path $Here "backups"
        New-Item -ItemType Directory -Force $dir | Out-Null
        $file = Join-Path $dir ("optifleet-{0}.dump" -f (Get-Date -Format "yyyyMMdd-HHmmss"))
        # Fișierul se scrie în container și apoi se copiază (PowerShell 5 strică datele binare la redirecționare).
        Invoke-Docker @("exec", "supabase-db", "pg_dump", "-U", "postgres", "-d", "postgres", "-Fc", "--no-owner", "-f", "/tmp/optifleet.dump")
        Invoke-Docker @("cp", "supabase-db:/tmp/optifleet.dump", $file)
        Invoke-Docker @("exec", "supabase-db", "rm", "-f", "/tmp/optifleet.dump")
        Get-ChildItem $dir -Filter "optifleet-*.dump" | Sort-Object LastWriteTime -Descending | Select-Object -Skip 14 | Remove-Item -Force
        Info ("Backup: {0} ({1:N1} MB). Copiază folderul backups pe un disc extern periodic." -f $file, ((Get-Item $file).Length / 1MB))
    }
    "status" {
        if (-not (Test-Docker)) { Write-Host "Docker nu rulează."; break }
        Push-Location $Stack
        try { docker compose ps --format "table {{.Name}}\t{{.Status}}" } finally { Pop-Location }
    }
}
