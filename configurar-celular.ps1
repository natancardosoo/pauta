# Pauta - libera o acesso pelo celular via Tailscale (so os seus aparelhos) e inicia junto com o Windows.
# Uso (na pasta do projeto):  powershell -ExecutionPolicy Bypass -File configurar-celular.ps1
$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

# 1. Tailscale Serve na porta 8444, so dentro da sua tailnet (nao usa Funnel e nao mexe nas outras portas).
tailscale serve --bg --https=8444 http://127.0.0.1:4321

# 2. Atalho na pasta Inicializar: o Pauta sobe em segundo plano quando voce entra no Windows.
$ws = New-Object -ComObject WScript.Shell
$lnk = $ws.CreateShortcut((Join-Path ([Environment]::GetFolderPath('Startup')) 'Pauta.lnk'))
$lnk.TargetPath = Join-Path $env:WINDIR 'System32\wscript.exe'
$lnk.Arguments = '"' + (Join-Path $PSScriptRoot 'iniciar.vbs') + '" /fundo'
$lnk.WorkingDirectory = $PSScriptRoot
$lnk.Description = 'Inicia o Pauta em segundo plano'
$lnk.Save()

# 3. Reinicia o Pauta para carregar a versao nova.
Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort 4321 -State Listen -ErrorAction SilentlyContinue |
  ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Start-Sleep -Seconds 1
Start-Process wscript -ArgumentList ('"' + (Join-Path $PSScriptRoot 'iniciar.vbs') + '" /fundo')

$dns = ((tailscale status --json | ConvertFrom-Json).Self.DNSName).TrimEnd('.')
Write-Host ""
Write-Host "Pronto. No celular (com o Tailscale ligado), abra:  https://$($dns):8444" -ForegroundColor Green
Write-Host "Registro: data\pauta.log"
