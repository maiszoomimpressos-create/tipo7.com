package br.com.tipo7.caixa

import android.app.admin.DevicePolicyManager
import android.content.BroadcastReceiver
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.util.Log

// Válvula de escape só por ADB — sem isso, tirar o aparelho do modo kiosk
// (Device Owner + Lock Task) exigiria factory reset. Não é alcançável por
// toque na tela nem por nenhum outro app (exported=true só importa pro
// `am broadcast` externo conseguir chamar, igual o PrintTestReceiver).
//
// Uso: adb shell am broadcast -a br.com.tipo7.caixa.KIOSK_DESATIVAR -n br.com.tipo7.caixa/.KioskControlReceiver
class KioskControlReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != "br.com.tipo7.caixa.KIOSK_DESATIVAR") return
        try {
            val dpm = context.getSystemService(Context.DEVICE_POLICY_SERVICE) as DevicePolicyManager
            val admin = ComponentName(context, AdminReceiver::class.java)
            if (dpm.isDeviceOwnerApp(context.packageName)) {
                dpm.setLockTaskPackages(admin, arrayOf())
                dpm.clearPackagePersistentPreferredActivities(admin, context.packageName)
            }
            // Tirar do allowlist não ejeta sozinho quem já está em Lock
            // Task (achado real testando) — precisa chamar stopLockTask()
            // na própria Activity travada.
            MainActivity.pararLockTaskSeAtivo()
            Log.w("Tipo7Kiosk", "Kiosk desativado via ADB (setLockTaskPackages vazio + Home persistente limpa + stopLockTask)")
        } catch (e: Exception) {
            Log.w("Tipo7Kiosk", "Falha ao desativar kiosk: ${e.message}")
        }
    }
}
