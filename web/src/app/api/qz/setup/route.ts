const FINGERPRINT = '8404E0908051F5F44BA79734D83515D9C6FE0929'

const BAT = `@echo off
chcp 65001 >nul
title Tipo7 - Impressao silenciosa

:: ── Localizar QZ Tray ──────────────────────────────────────────────────────
set "QZEXE="
if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe"         set "QZEXE=%ProgramFiles%\\QZ Tray\\qz-tray.exe"
if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"    set "QZEXE=%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
if exist "%LocalAppData%\\QZ Tray\\qz-tray.exe"          set "QZEXE=%LocalAppData%\\QZ Tray\\qz-tray.exe"
if exist "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe" set "QZEXE=%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"

:: ── Instalar se nao encontrado ─────────────────────────────────────────────
if "%QZEXE%"=="" (
    echo Baixando QZ Tray, aguarde...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "$r = Invoke-WebRequest 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; ^
         $u = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; ^
         Invoke-WebRequest $u -OutFile '$env:TEMP\\qz-inst.exe' -UseBasicParsing"
    if not exist "%TEMP%\\qz-inst.exe" (
        echo ERRO: nao foi possivel baixar. Acesse qz.io/download e instale.
        pause & exit /b 1
    )
    echo Instalando...
    "%TEMP%\\qz-inst.exe" /S
    timeout /t 15 /nobreak >nul
    del "%TEMP%\\qz-inst.exe" >nul 2>&1
    if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe"         set "QZEXE=%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"    set "QZEXE=%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    if exist "%LocalAppData%\\QZ Tray\\qz-tray.exe"          set "QZEXE=%LocalAppData%\\QZ Tray\\qz-tray.exe"
    if exist "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe" set "QZEXE=%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
    if "%QZEXE%"=="" (
        echo ERRO: instalacao falhou. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
)

:: ── Gravar fingerprint do certificado tipo7.com ────────────────────────────
if not exist "%APPDATA%\\qz" mkdir "%APPDATA%\\qz"
powershell -NoProfile -Command "[IO.File]::WriteAllText('%APPDATA%\\qz\\allowed.dat', '${FINGERPRINT}\r\n', [Text.Encoding]::ASCII)"

:: ── Reiniciar QZ Tray ─────────────────────────────────────────────────────
taskkill /f /im qz-tray.exe >nul 2>&1
timeout /t 2 /nobreak >nul
start "" "%QZEXE%"
timeout /t 6 /nobreak >nul

:: Verifica se esta rodando; tenta de novo se nao
tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if errorlevel 1 (
    start "" "%QZEXE%"
    timeout /t 5 /nobreak >nul
)

echo.
echo  Pronto! Volte ao navegador - vai conectar automaticamente.
echo.
timeout /t 4 /nobreak >nul
`

export async function GET() {
  return new Response(BAT, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="configurar-tipo7.bat"',
    },
  })
}
