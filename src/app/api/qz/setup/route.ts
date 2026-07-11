const FINGERPRINT = '8404E0908051F5F44BA79734D83515D9C6FE0929'

const BAT = `@echo off
chcp 65001 >nul
title Tipo7 - Configurando QZ Tray
echo.
echo  ================================================
echo   Tipo7 - Configurando impressao silenciosa
echo  ================================================
echo.

:: ── PASSO 1: Buscar QZ Tray em todos os locais possiveis ──────────────────
echo  [1/4] Procurando QZ Tray...
set "QZEXE="

for %%P in (
    "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
    "%APPDATA%\\QZ Tray\\qz-tray.exe"
) do if exist %%~P (
    set "QZEXE=%%~P"
    echo        Encontrado: %%~P
)

:: Busca adicional via where (encontra no PATH do sistema)
if "%QZEXE%"=="" (
    for /f "delims=" %%F in ('where qz-tray.exe 2^>nul') do (
        set "QZEXE=%%F"
        echo        Encontrado via PATH: %%F
    )
)

:: ── PASSO 2: Instalar se nao encontrado ───────────────────────────────────
if "%QZEXE%"=="" (
    echo        Nao encontrado. Baixando e instalando...
    echo  [2/4] Instalando QZ Tray ^(aguarde^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { $r = Invoke-WebRequest 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; $u = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; Write-Host ('Baixando: ' + $u); Invoke-WebRequest $u -OutFile \"$env:TEMP\\qz-inst.exe\" -UseBasicParsing; Write-Host 'Download concluido.' } catch { Write-Host ('Erro: ' + $_.Exception.Message) }"
    if not exist "%TEMP%\\qz-inst.exe" (
        echo  [ERRO] Download falhou. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
    "%TEMP%\\qz-inst.exe" /S
    echo        Aguardando instalacao terminar...
    timeout /t 10 /nobreak >nul
    del "%TEMP%\\qz-inst.exe" >nul 2>&1
    for %%P in (
        "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
        "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
        "%LocalAppData%\\QZ Tray\\qz-tray.exe"
        "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
        "%APPDATA%\\QZ Tray\\qz-tray.exe"
    ) do if exist %%~P set "QZEXE=%%~P"
    if "%QZEXE%"=="" (
        echo  [ERRO] Instalacao falhou. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
    echo        QZ Tray instalado com sucesso.
) else (
    echo  [2/4] QZ Tray ja instalado. OK.
)

:: ── PASSO 3: Gravar certificado de confianca tipo7.com ────────────────────
echo  [3/4] Configurando certificado tipo7.com...
if not exist "%APPDATA%\\qz" mkdir "%APPDATA%\\qz"
powershell -NoProfile -Command "[IO.File]::WriteAllText('%APPDATA%\\qz\\allowed.dat', '${FINGERPRINT}\r\n', [Text.Encoding]::ASCII)"
echo        Certificado gravado.

:: ── PASSO 4: Reiniciar QZ Tray e testar ──────────────────────────────────
echo  [4/4] Reiniciando QZ Tray e testando...
taskkill /f /im qz-tray.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%QZEXE%"
echo        Aguardando QZ Tray iniciar...
timeout /t 4 /nobreak >nul

:: Teste 1: processo rodando?
tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if errorlevel 1 (
    echo        Processo nao detectado, tentando novamente...
    start "" "%QZEXE%"
    timeout /t 4 /nobreak >nul
)

:: Teste 2: porta 8181 respondendo?
netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
if errorlevel 1 (
    echo        Aguardando porta 8181...
    timeout /t 3 /nobreak >nul
    netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
    if errorlevel 1 (
        echo        [AVISO] Porta 8181 ainda nao responde. QZ Tray pode demorar alguns segundos.
    ) else (
        echo        [OK] Porta 8181 ativa - QZ Tray funcionando!
    )
) else (
    echo        [OK] Porta 8181 ativa - QZ Tray funcionando!
)

echo.
echo  ================================================
echo   Pronto! Volte ao navegador.
echo   A pagina vai conectar automaticamente.
echo  ================================================
echo.
timeout /t 2 /nobreak >nul
`

export async function GET() {
  return new Response(BAT, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="configurar-tipo7.bat"',
    },
  })
}
