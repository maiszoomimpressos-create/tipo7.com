package br.com.tipo7.caixa

import android.annotation.SuppressLint
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

// Casca nativa fina que carrega a mesma /caixa que já roda no navegador
// (Bilheteria/Estacionamento/PWA — ver docs/plano-terminais-caixa-pwa.md).
// Não recria nenhuma tela: só embrulha a WebView e expõe a ponte
// CobrancaBridge pro botão "Cobrar Cartão" da própria página web chamar.
// Ver docs/maquininha-gpos780-levantamento-requisitos.md, seção "App único
// cobrindo Bilheteria/Estacionamento/Tenda/Praça de Alimentação".
class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Terminal fixo de bancada — nunca apaga a tela sozinho (decisão já
        // confirmada também nas Configurações do próprio aparelho, isso é
        // reforço do lado do app).
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true // localStorage — a sessão/token do site depende disso
        webView.settings.databaseEnabled = true
        webView.webViewClient = WebViewClient() // mantém toda navegação dentro do próprio WebView

        // Sem isso, console.log/error/warn do lado da página (React, fetch
        // que falhou etc.) nunca aparecem no logcat — fica impossível
        // diagnosticar problema de JS só olhando a tela. Só serve pra debug
        // (BuildConfig.DEBUG), não precisa em release.
        if (BuildConfig.DEBUG) {
            webView.webChromeClient = object : WebChromeClient() {
                override fun onConsoleMessage(msg: ConsoleMessage): Boolean {
                    Log.d("Tipo7WebView", "${msg.messageLevel()} ${msg.sourceId()}:${msg.lineNumber()} — ${msg.message()}")
                    return true
                }
            }
        }

        webView.addJavascriptInterface(CobrancaBridge(webView, baseUrl()), "CobrancaBridge")

        webView.loadUrl(baseUrl() + "/caixa")
    }

    private fun baseUrl(): String =
        if (BuildConfig.DEBUG) BuildConfig.BASE_URL_DEBUG else BuildConfig.BASE_URL_RELEASE

    // Terminal de caixa não deve "sair" do app com o botão voltar do Android
    // — só navega pra trás dentro da própria WebView, se der.
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else { /* não faz nada — kiosk */ }
    }
}
