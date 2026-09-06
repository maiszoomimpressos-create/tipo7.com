package br.com.tipo7.caixa

import android.util.Log
import android.webkit.JavascriptInterface
import android.webkit.WebView
import okhttp3.Call
import okhttp3.Callback
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.toRequestBody
import org.json.JSONObject
import java.io.IOException

// Contrato JS↔Android pro pagamento com cartão físico.
//
// A página web (rodando dentro da WebView, servida pelo mesmo /caixa que já
// existe hoje) chama:
//
//   window.CobrancaBridge.cobrarCartao(valorReais, caixaId, origem, origemId, authToken, callbackId)
//
// E recebe o resultado de volta via:
//
//   window.Tipo7CobrancaCallback(callbackId, jsonDoResultado)
//
// FASE ATUAL (mock): esse método só repassa a chamada pro backend
// (POST /api/pagamentos-fisicos/cobrar), que hoje usa o MockPaymentProvider
// — nenhum cartão é lido de verdade ainda. Quando o SDK real de TEF entrar
// (SiTef/PayGo, ver docs/maquininha-gpos780-levantamento-requisitos.md),
// só o CORPO deste método muda pra acionar o SDK nativo antes de bater no
// backend — o contrato acima (nomes/parâmetros/callback) foi desenhado pra
// não precisar mudar do lado da página web.
//
// authToken vem da própria página (mesmo token que ela já usa em
// apiFetchAuth, ver web/src/lib/auth/session.ts) porque esta chamada não
// passa pelo proxy same-origin do Next.js — é HTTP nativo direto pro
// domínio configurado em BASE_URL_DEBUG/RELEASE.
class CobrancaBridge(private val webView: WebView, private val baseUrl: String) {

    private val client = OkHttpClient()
    private val jsonMediaType = "application/json; charset=utf-8".toMediaType()

    @JavascriptInterface
    fun cobrarCartao(
        valorReais: Double,
        caixaId: String,
        origem: String,
        origemId: String?,
        authToken: String,
        callbackId: String,
    ) {
        val payload = JSONObject().apply {
            put("valor", valorReais)
            put("caixaId", caixaId)
            put("origem", origem)
            if (!origemId.isNullOrBlank()) put("origemId", origemId)
        }

        val request = Request.Builder()
            .url(baseUrl.trimEnd('/') + "/api/pagamentos-fisicos/cobrar")
            .addHeader("Authorization", "Bearer $authToken")
            .post(payload.toString().toRequestBody(jsonMediaType))
            .build()

        client.newCall(request).enqueue(object : Callback {
            override fun onFailure(call: Call, e: IOException) {
                Log.e("CobrancaBridge", "Falha de rede ao cobrar cartão", e)
                respond(callbackId, JSONObject().apply {
                    put("status", "erro")
                    put("mensagemErro", "Falha de comunicação com o servidor: ${e.message}")
                })
            }

            override fun onResponse(call: Call, response: okhttp3.Response) {
                val bodyStr = response.body?.string().orEmpty()
                response.close()
                if (!response.isSuccessful) {
                    Log.e("CobrancaBridge", "Backend respondeu ${response.code}: $bodyStr")
                    respond(callbackId, JSONObject().apply {
                        put("status", "erro")
                        put("mensagemErro", "Servidor respondeu ${response.code}")
                    })
                    return
                }
                val resultJson = try {
                    JSONObject(bodyStr)
                } catch (e: Exception) {
                    JSONObject().apply {
                        put("status", "erro")
                        put("mensagemErro", "Resposta inválida do servidor")
                    }
                }
                respond(callbackId, resultJson)
            }
        })
    }

    private fun respond(callbackId: String, resultJson: JSONObject) {
        // evaluateJavascript só pode ser chamado na UI thread; o callback do
        // OkHttp roda numa thread própria.
        webView.post {
            val js = "window.Tipo7CobrancaCallback && window.Tipo7CobrancaCallback(" +
                JSONObject.quote(callbackId) + "," + resultJson.toString() + ");"
            webView.evaluateJavascript(js, null)
        }
    }
}
