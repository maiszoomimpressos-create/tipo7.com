package br.com.tipo7.caixa

import android.content.Context
import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import kotlin.concurrent.thread

// Contrato JS↔Android pra impressão térmica real via GEDI (impressora
// embutida da GPOS780) — mesmo padrão de CobrancaBridge.kt.
//
// A página web (BilheteiroClient.tsx, ver web/src/lib/gediPrint.ts) chama:
//
//   window.PrinterBridge.imprimirIngressos(jsonArrayDeIngressos, callbackId)
//
// E recebe o resultado de volta via:
//
//   window.Tipo7ImpressaoCallback(callbackId, jsonDoResultado)
//
// Roda em thread separada (mesma cautela de PrintTestReceiver.kt — uma
// chamada de API de hardware já travou a WebView inteira uma vez, mesmo em
// thread própria; aqui pelo menos isola o travamento nessa thread, não
// trava o app inteiro) e nunca lança exceção pro chamador — sempre responde
// via callback, ok ou erro.
class PrinterBridge(private val context: Context, private val webView: WebView) {

    @JavascriptInterface
    fun imprimirIngressos(ticketsJson: String, callbackId: String) {
        thread(name = "PrinterBridge") {
            try {
                PrinterHelper.imprimirIngressos(context, ticketsJson)
                respond(callbackId, ok = true, erro = null)
            } catch (e: Throwable) {
                Log.w("Tipo7Printer", "Falha ao imprimir ingressos: ${e.message}", e)
                respond(callbackId, ok = false, erro = e.message ?: "Falha desconhecida ao imprimir")
            }
        }
    }

    private fun respond(callbackId: String, ok: Boolean, erro: String?) {
        webView.post {
            val json = org.json.JSONObject().apply {
                put("ok", ok)
                if (erro != null) put("erro", erro)
            }
            val js = "window.Tipo7ImpressaoCallback && window.Tipo7ImpressaoCallback(" +
                org.json.JSONObject.quote(callbackId) + "," + json.toString() + ");"
            webView.evaluateJavascript(js, null)
        }
    }
}
