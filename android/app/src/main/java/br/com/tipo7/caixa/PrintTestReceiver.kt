package br.com.tipo7.caixa

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import kotlin.concurrent.thread

// Gatilho de teste isolado, disparado só via ADB — de propósito, não
// automático no boot do app. Lição de ontem com a GANDI: uma chamada de API
// de hardware travou a WebView inteira mesmo em thread separada; aqui o
// teste roda completamente desacoplado do ciclo de vida do MainActivity —
// se travar, só trava essa thread, o app continua normal (a WebView já
// carregou antes de qualquer chance de disparar isso).
//
// Uso: adb shell am broadcast -a br.com.tipo7.caixa.TESTE_IMPRESSAO -n br.com.tipo7.caixa/.PrintTestReceiver
class PrintTestReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        val appContext = context.applicationContext
        thread(name = "PrintTest") {
            PrinterHelper.testeImpressao(appContext)
        }
    }
}
