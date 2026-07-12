const FINGERPRINT = 'FF36A5373096B6C31B2CF39F9D8422AD7514AD40'

// Script PowerShell que roda em background e clica Allow automaticamente
// em qualquer popup do QZ Tray, sem interação do usuário
const AUTOALLOW_PS1 = `Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class QZAuto {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool ShowWindow(IntPtr h, int cmd);
}
'@
Add-Type -AssemblyName System.Windows.Forms
while ($true) {
    try {
        [QZAuto]::EnumWindows({
            param($h, $lp)
            if (-not [QZAuto]::IsWindowVisible($h)) { return $true }
            $sb = New-Object Text.StringBuilder 256
            [QZAuto]::GetWindowText($h, $sb, 256) | Out-Null
            $t = $sb.ToString()
            if ($t -eq 'QZ Tray' -or $t -match 'Action Required|Site Access|Allow Print|Printer Access|Untrusted') {
                [QZAuto]::SetForegroundWindow($h) | Out-Null
                Start-Sleep -Milliseconds 150
                [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
                Start-Sleep -Milliseconds 300
            }
            return $true
        }, [IntPtr]::Zero)
    } catch {}
    Start-Sleep -Milliseconds 400
}
`

function buildBat(certUrl: string) {
  const ps1B64 = Buffer.from(AUTOALLOW_PS1, 'utf8').toString('base64')

  return `@echo off
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
        "try { $r = Invoke-WebRequest 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; $u = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; Write-Host ('Baixando: ' + $u); Invoke-WebRequest $u -OutFile \\"$env:TEMP\\\\qz-inst.exe\\" -UseBasicParsing; Write-Host 'Download concluido.' } catch { Write-Host ('Erro: ' + $_.Exception.Message) }"
    if not exist "%TEMP%\\qz-inst.exe" (
        echo  [ERRO] Download falhou. Acesse qz.io/download e instale manualmente.
        pause & exit /b 1
    )
    "%TEMP%\\qz-inst.exe" /S
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

:: ── PASSO 3: Configurar tipo7.com — certificado + sem popups ──────────────
echo  [3/4] Configurando certificado e aprovacao automatica...
if not exist "%APPDATA%\\qz" mkdir "%APPDATA%\\qz"

:: fingerprint (aprova conexao do site)
powershell -NoProfile -Command "[IO.File]::WriteAllText('%APPDATA%\\qz\\allowed.dat', '${FINGERPRINT}\\r\\n', [Text.Encoding]::ASCII)"

:: certificado permanente (elimina popup de confianca)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest '${certUrl}' -UseBasicParsing -OutFile '%APPDATA%\\qz\\authcert.pem'; Write-Host 'Certificado permanente: OK' } catch { Write-Host ('Aviso: ' + $_.Exception.Message) }"

:: configuracao QZ Tray sem popup de impressora
powershell -NoProfile -Command ^
    "[IO.File]::WriteAllText('%APPDATA%\\qz\\qz-tray.properties', 'security.blockUntrustedPrinters=false' + [char]13 + [char]10, [Text.Encoding]::ASCII)"

:: gravar script de aprovacao automatica de popups
powershell -NoProfile -Command ^
    "$b64='${ps1B64}'; [IO.File]::WriteAllBytes('%APPDATA%\\qz\\autoallow.ps1', [Convert]::FromBase64String($b64))"

:: registrar script no inicio do Windows (roda sempre que ligar o PC)
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "QZAutoAllow" /t REG_SZ /d "powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \\"%APPDATA%\\qz\\autoallow.ps1\\"" /f >nul 2>&1

:: iniciar agora (sem janela visivel)
start /B powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%APPDATA%\\qz\\autoallow.ps1"
echo        Configuracoes gravadas. Aprovacao automatica ativa.

:: ── PASSO 4: Reiniciar QZ Tray e testar ──────────────────────────────────
echo  [4/4] Reiniciando QZ Tray e testando...
taskkill /f /im qz-tray.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%QZEXE%"
echo        Aguardando QZ Tray iniciar...
timeout /t 4 /nobreak >nul

tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if errorlevel 1 (
    echo        Processo nao detectado, tentando novamente...
    start "" "%QZEXE%"
    timeout /t 4 /nobreak >nul
)

netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
if errorlevel 1 (
    timeout /t 3 /nobreak >nul
    netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
    if errorlevel 1 (
        echo        [AVISO] Porta 8181 ainda nao responde. Aguarde alguns segundos.
    ) else (
        echo        [OK] Porta 8181 ativa - QZ Tray funcionando!
    )
) else (
    echo        [OK] Porta 8181 ativa - QZ Tray funcionando!
)

echo.
echo  ================================================
echo   Pronto! Volte ao navegador.
echo   Qualquer popup do QZ Tray sera aprovado
echo   automaticamente a partir de agora.
echo  ================================================
echo.
timeout /t 2 /nobreak >nul
`
}

export async function GET(req: Request) {
  const origin = new URL(req.url).origin
  const bat = buildBat(`${origin}/api/qz/cert`)
  return new Response(bat, {
    headers: {
      'Content-Type': 'application/octet-stream',
      'Content-Disposition': 'attachment; filename="configurar-tipo7.bat"',
    },
  })
}
