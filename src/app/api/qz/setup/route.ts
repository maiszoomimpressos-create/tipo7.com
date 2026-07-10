// Serve o script .bat que configura o QZ Tray automaticamente no computador do operador
const FINGERPRINT = '20F8515E2BAA1E90679D294EA8CB8376E2D4CD5A'

const BAT = `@echo off
chcp 65001 >nul
echo.
echo  =====================================================
echo   Configurando impressao silenciosa - Tipo7
echo  =====================================================
echo.

set QZDIR=%APPDATA%\\qz
set ALLOWED=%QZDIR%\\allowed.dat

:: Garante que a pasta existe
if not exist "%QZDIR%" mkdir "%QZDIR%"

:: Adiciona o fingerprint do certificado tipo7.com (se ainda nao estiver)
findstr /c:"${FINGERPRINT}" "%ALLOWED%" >nul 2>&1
if errorlevel 1 (
    echo ${FINGERPRINT}>> "%ALLOWED%"
    echo  [OK] Certificado tipo7.com adicionado.
) else (
    echo  [OK] Certificado ja configurado.
)

:: Reinicia o QZ Tray para carregar o novo certificado
echo  Reiniciando QZ Tray...
taskkill /f /im "qz-tray.exe" >nul 2>&1
timeout /t 2 /nobreak >nul

:: Tenta iniciar o QZ Tray nos caminhos mais comuns
if exist "%ProgramFiles%\\QZ Tray\\qz-tray.exe" (
    start "" "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    goto :fim
)
if exist "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe" (
    start "" "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    goto :fim
)
if exist "%LocalAppData%\\QZ Tray\\qz-tray.exe" (
    start "" "%LocalAppData%\\QZ Tray\\qz-tray.exe"
    goto :fim
)
echo  [AVISO] QZ Tray nao encontrado - abra manualmente apos instalar.

:fim
echo.
echo  Pronto! Aguarde 3 segundos e recarregue a bilheteria no navegador.
echo.
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
