const FINGERPRINT = '20F8515E2BAA1E90679D294EA8CB8376E2D4CD5A'

const BAT = `@echo off
chcp 65001 >nul
title Tipo7 - Configurando impressao silenciosa
echo.
echo  =====================================================
echo   Tipo7 - Configurando impressao silenciosa
echo  =====================================================
echo.

:: ── Passo 1: Verificar/instalar QZ Tray ─────────────────────────────────────
set "QZEXE="
if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe"      set "QZEXE=%ProgramFiles%\\QZ Tray\\qz-tray.exe"
if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe" set "QZEXE=%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
if exist "%LocalAppData%\\QZ Tray\\qz-tray.exe"       set "QZEXE=%LocalAppData%\\QZ Tray\\qz-tray.exe"

if "%QZEXE%"=="" (
    echo  [1/3] Baixando QZ Tray ^(pode demorar alguns segundos^)...
    powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; $url = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; Invoke-WebRequest -Uri $url -OutFile '%TEMP%\\qz-installer.exe' -UseBasicParsing; Write-Host 'Download OK' } catch { Write-Host 'Erro:' $_.Exception.Message }"
    if not exist "%TEMP%\\qz-installer.exe" (
        echo  [ERRO] Nao foi possivel baixar. Instale manualmente em: qz.io/download
        pause & exit /b
    )
    echo  Instalando... aguarde.
    "%TEMP%\\qz-installer.exe" /S
    timeout /t 8 /nobreak >nul
    del "%TEMP%\\qz-installer.exe" >nul 2>&1
    if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe"      set "QZEXE=%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe" set "QZEXE=%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    if exist "%LocalAppData%\\QZ Tray\\qz-tray.exe"       set "QZEXE=%LocalAppData%\\QZ Tray\\qz-tray.exe"
    echo  [OK] QZ Tray instalado.
) else (
    echo  [OK] QZ Tray ja instalado.
)

:: ── Passo 2: Configurar certificado tipo7.com ────────────────────────────────
echo  [2/3] Configurando certificado tipo7.com...
set "QZDIR=%APPDATA%\\qz"
set "ALLOWED=%QZDIR%\\allowed.dat"
if not exist "%QZDIR%" mkdir "%QZDIR%"

findstr /c:"${FINGERPRINT}" "%ALLOWED%" >nul 2>&1
if errorlevel 1 (
    echo ${FINGERPRINT}>> "%ALLOWED%"
    echo  [OK] Certificado adicionado.
) else (
    echo  [OK] Certificado ja configurado.
)

:: ── Passo 3: Iniciar QZ Tray ─────────────────────────────────────────────────
echo  [3/3] Iniciando QZ Tray...
taskkill /f /im "qz-tray.exe" >nul 2>&1
timeout /t 2 /nobreak >nul
if not "%QZEXE%"=="" (
    start "" "%QZEXE%"
    timeout /t 3 /nobreak >nul
    echo  [OK] QZ Tray iniciado.
) else (
    echo  [AVISO] Nao encontrado - abra o QZ Tray manualmente.
)

echo.
echo  =====================================================
echo   Pronto! Volte ao navegador e clique em Recarregar.
echo  =====================================================
echo.
pause
`

export async function GET() {
  return new Response(BAT, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="configurar-tipo7.bat"',
    },
  })
}
