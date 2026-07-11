const FINGERPRINT = '8404E0908051F5F44BA79734D83515D9C6FE0929'
const OLD_FINGERPRINT = '20F8515E2BAA1E90679D294EA8CB8376E2D4CD5A'

const BAT = `@echo off
chcp 65001 >nul
title Tipo7 - Configurando impressao silenciosa

:: ── Localizar QZ Tray ──────────────────────────────────────────────────────
set "QZEXE="
for %%P in (
    "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
) do if exist %%~P set "QZEXE=%%~P"

:: ── Instalar se nao encontrado ─────────────────────────────────────────────
if "%QZEXE%"=="" (
    echo Baixando QZ Tray, aguarde...
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; $url = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; Invoke-WebRequest -Uri $url -OutFile '%TEMP%\\qz-installer.exe' -UseBasicParsing } catch { }"
    if not exist "%TEMP%\\qz-installer.exe" (
        echo ERRO: nao foi possivel baixar. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
    echo Instalando...
    "%TEMP%\\qz-installer.exe" /S
    timeout /t 12 /nobreak >nul
    del "%TEMP%\\qz-installer.exe" >nul 2>&1
    for %%P in (
        "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
        "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
        "%LocalAppData%\\QZ Tray\\qz-tray.exe"
        "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
    ) do if exist %%~P set "QZEXE=%%~P"
    if "%QZEXE%"=="" (
        echo ERRO: instalacao falhou. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
)

:: ── Configurar certificado tipo7.com ──────────────────────────────────────
set "QZDIR=%APPDATA%\\qz"
set "ALLOWED=%QZDIR%\\allowed.dat"
if not exist "%QZDIR%" mkdir "%QZDIR%"

:: Limpa fingerprints antigos e adiciona o atual
if exist "%ALLOWED%" (
    powershell -NoProfile -Command "$lines = (Get-Content '%ALLOWED%' -ErrorAction SilentlyContinue) | Where-Object { $_ -notmatch '${OLD_FINGERPRINT}' -and $_ -notmatch '${FINGERPRINT}' }; $lines | Set-Content '%ALLOWED%' -Encoding ASCII"
)
echo ${FINGERPRINT}>> "%ALLOWED%"

:: ── Iniciar QZ Tray ───────────────────────────────────────────────────────
taskkill /f /im "qz-tray.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "%QZEXE%"
timeout /t 5 /nobreak >nul

:: Verifica se iniciou; tenta de novo se nao
tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if errorlevel 1 (
    start "" "%QZEXE%"
    timeout /t 4 /nobreak >nul
)

echo Pronto! Volte ao navegador - vai conectar sozinho.
timeout /t 3 /nobreak >nul
`

export async function GET() {
  return new Response(BAT, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="configurar-tipo7.bat"',
    },
  })
}
