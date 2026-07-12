const FINGERPRINT = 'FF36A5373096B6C31B2CF39F9D8422AD7514AD40'

// Script PowerShell que roda em background.
// Usa UIAutomation (.NET) para interagir com a UI Java do QZ Tray:
//   1. Encontra qualquer janela de popup do QZ Tray
//   2. Marca o checkbox "Lembrar sempre" (via UIAutomation)
//   3. Clica em Allow (via UIAutomation ou Enter como fallback)
const AUTOALLOW_PS1 = `Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes, System.Windows.Forms
Add-Type @'
using System;
using System.Runtime.InteropServices;
using System.Text;
public class WinH {
    [DllImport("user32.dll")] public static extern bool EnumWindows(EnumWindowsProc cb, IntPtr lp);
    public delegate bool EnumWindowsProc(IntPtr hWnd, IntPtr lParam);
    [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
    [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
    [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h);
    [DllImport("user32.dll")] public static extern bool BringWindowToTop(IntPtr h);
}
'@

function Invoke-Allow {
    param([IntPtr]$hWnd)
    # Tenta UIAutomation (funciona com Java Swing via .NET accessibility)
    try {
        $root  = [System.Windows.Automation.AutomationElement]::RootElement
        $hCond = New-Object System.Windows.Automation.PropertyCondition(
            [System.Windows.Automation.AutomationElement]::NativeWindowHandleProperty, [int]$hWnd)
        $win = $root.FindFirst(
            [System.Windows.Automation.TreeScope]::Children, $hCond)
        if ($win -ne $null) {
            # Marca checkbox "Remember" / "Lembrar" se existir
            $chkCond = New-Object System.Windows.Automation.PropertyCondition(
                [System.Windows.Automation.AutomationElement]::ControlTypeProperty,
                [System.Windows.Automation.ControlType]::CheckBox)
            $chk = $win.FindFirst(
                [System.Windows.Automation.TreeScope]::Descendants, $chkCond)
            if ($chk -ne $null) {
                try {
                    $tp = $chk.GetCurrentPattern(
                        [System.Windows.Automation.TogglePattern]::Pattern)
                    if ($tp.Current.ToggleState -ne `
                        [System.Windows.Automation.ToggleState]::On) { $tp.Toggle() }
                } catch {}
            }
            # Clica Allow / Permitir
            foreach ($name in @('Allow','Permitir','Yes','Sim','OK')) {
                $bCond = New-Object System.Windows.Automation.PropertyCondition(
                    [System.Windows.Automation.AutomationElement]::NameProperty, $name)
                $btn = $win.FindFirst(
                    [System.Windows.Automation.TreeScope]::Descendants, $bCond)
                if ($btn -ne $null) {
                    try {
                        $ip = $btn.GetCurrentPattern(
                            [System.Windows.Automation.InvokePattern]::Pattern)
                        $ip.Invoke()
                        return
                    } catch {}
                }
            }
        }
    } catch {}
    # Fallback: teclado (Enter ativa o botao padrao Allow)
    [WinH]::BringWindowToTop($hWnd) | Out-Null
    [WinH]::SetForegroundWindow($hWnd) | Out-Null
    Start-Sleep -Milliseconds 200
    [System.Windows.Forms.SendKeys]::SendWait('{ENTER}')
}

while ($true) {
    try {
        [WinH]::EnumWindows({
            param($h, $lp)
            if (-not [WinH]::IsWindowVisible($h)) { return $true }
            $sb = New-Object Text.StringBuilder 256
            [WinH]::GetWindowText($h, $sb, 256) | Out-Null
            $t = $sb.ToString()
            if ($t -eq 'QZ Tray' -or $t -match 'Site Access|Allow Print|Printer Access') {
                Invoke-Allow -hWnd $h
                Start-Sleep -Milliseconds 500
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

:: ── PASSO 1: Buscar QZ Tray ───────────────────────────────────────────────
echo  [1/4] Procurando QZ Tray...
set "QZEXE="
set "QZDIR="

for %%P in (
    "%ProgramFiles%\\QZ Tray\\qz-tray.exe"
    "%ProgramFiles(x86)%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\QZ Tray\\qz-tray.exe"
    "%LocalAppData%\\Programs\\QZ Tray\\qz-tray.exe"
    "%APPDATA%\\QZ Tray\\qz-tray.exe"
) do if exist %%~P (
    set "QZEXE=%%~P"
    for %%D in ("%%~dpP.") do set "QZDIR=%%~fD"
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
    echo  [2/4] Instalando QZ Tray ^(aguarde^)...
    powershell -NoProfile -ExecutionPolicy Bypass -Command ^
        "try { $r = Invoke-WebRequest 'https://api.github.com/repos/qzind/tray/releases/latest' -UseBasicParsing | ConvertFrom-Json; $u = ($r.assets | Where-Object { $_.name -like '*.exe' } | Select-Object -First 1).browser_download_url; Invoke-WebRequest $u -OutFile \\"$env:TEMP\\\\qz-inst.exe\\" -UseBasicParsing; Write-Host 'Download OK.' } catch { Write-Host ('Erro: ' + $_.Exception.Message) }"
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
    ) do if exist %%~P (
        set "QZEXE=%%~P"
        for %%D in ("%%~dpP.") do set "QZDIR=%%~fD"
    )
    if "%QZEXE%"=="" (
        echo  [ERRO] Instalacao falhou.
        pause & exit /b 1
    )
    echo        QZ Tray instalado.
) else (
    echo  [2/4] QZ Tray ja instalado. OK.
)

:: ── PASSO 3: Configurar certificado, permissoes e aprovacao automatica ────
echo  [3/4] Configurando certificado e aprovacao automatica...
if not exist "%APPDATA%\\qz" mkdir "%APPDATA%\\qz"

:: Habilitar Java Access Bridge (permite UIAutomation acessar UI Java do QZ Tray)
for %%J in (
    "%QZDIR%\\runtime\\bin\\jabswitch.exe"
    "%ProgramFiles%\\Java\\jre*\\bin\\jabswitch.exe"
    "%ProgramFiles(x86)%\\Java\\jre*\\bin\\jabswitch.exe"
) do if exist "%%~J" (
    "%%~J" -enable >nul 2>&1
    echo        Java Access Bridge habilitado.
)

:: Fingerprint de confianca do certificado
powershell -NoProfile -Command "[IO.File]::WriteAllText('%APPDATA%\\qz\\allowed.dat', '${FINGERPRINT}\\r\\n', [Text.Encoding]::ASCII)"

:: Certificado permanente (elimina popup de confianca)
powershell -NoProfile -ExecutionPolicy Bypass -Command ^
    "try { Invoke-WebRequest '${certUrl}' -UseBasicParsing -OutFile '%APPDATA%\\qz\\authcert.pem' } catch { Write-Host ('Aviso cert: ' + $_.Exception.Message) }"

:: Desabilitar popup de impressora via propriedades do QZ Tray
powershell -NoProfile -Command ^
    "[IO.File]::WriteAllText('%APPDATA%\\qz\\qz-tray.properties', 'security.blockUntrustedPrinters=false' + [char]13 + [char]10, [Text.Encoding]::ASCII)"

:: Gravar script de aprovacao automatica de popups
powershell -NoProfile -Command ^
    "$b64='${ps1B64}'; [IO.File]::WriteAllBytes('%APPDATA%\\qz\\autoallow.ps1', [Convert]::FromBase64String($b64))"

:: Registrar no startup do Windows
reg add "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run" /v "QZAutoAllow" /t REG_SZ /d "powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File \\"%APPDATA%\\qz\\autoallow.ps1\\"" /f >nul 2>&1

:: Matar instancia antiga do script se estiver rodando e reiniciar
taskkill /f /fi "IMAGENAME eq powershell.exe" /fi "WINDOWTITLE eq QZAutoAllow*" >nul 2>&1
start /B powershell -WindowStyle Hidden -NoProfile -ExecutionPolicy Bypass -File "%APPDATA%\\qz\\autoallow.ps1"
echo        Aprovacao automatica ativa.

:: ── PASSO 4: Reiniciar QZ Tray e testar ──────────────────────────────────
echo  [4/4] Reiniciando QZ Tray e testando...
taskkill /f /im qz-tray.exe >nul 2>&1
timeout /t 1 /nobreak >nul
start "" "%QZEXE%"
timeout /t 5 /nobreak >nul

tasklist /fi "imagename eq qz-tray.exe" 2>nul | find /i "qz-tray.exe" >nul
if errorlevel 1 (
    start "" "%QZEXE%"
    timeout /t 4 /nobreak >nul
)

netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
if errorlevel 1 (
    timeout /t 3 /nobreak >nul
    netstat -an 2>nul | find ":8181" | find "LISTEN" >nul
    if errorlevel 1 (
        echo        [AVISO] Porta 8181 ainda nao responde.
    ) else (
        echo        [OK] Porta 8181 ativa!
    )
) else (
    echo        [OK] Porta 8181 ativa!
)

echo.
echo  ================================================
echo   Pronto! A partir de agora qualquer popup
echo   do QZ Tray sera aprovado automaticamente.
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
