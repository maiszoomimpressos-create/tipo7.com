package br.com.tipo7.caixa

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent

// Terminal de bancada fixo: liga e já cai direto no nosso painel de
// token/PIN, sem passar por nenhuma tela do Android. Reforço em cima de
// sermos o app Home persistente (ver MainActivity) — cobre o caso raro de
// o sistema não escolher a Home automaticamente logo após o boot.
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action != Intent.ACTION_BOOT_COMPLETED) return
        val launch = Intent(context, MainActivity::class.java)
        launch.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        context.startActivity(launch)
    }
}
