package br.com.tipo7.caixa

import android.annotation.SuppressLint
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
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

    companion object {
        // Referência fraca da Activity ativa — usada só pela válvula de
        // escape (KioskControlReceiver), que roda fora do ciclo de vida
        // da Activity e não tem outro jeito de acionar stopLockTask()
        // (é método de instância, só a própria Activity travada pode
        // chamar).
        private var instancia: MainActivity? = null

        fun pararLockTaskSeAtivo() {
            instancia?.let { activity ->
                try {
                    activity.stopLockTask()
                } catch (e: Exception) {
                    Log.w("Tipo7Kiosk", "stopLockTask() (via válvula de escape) falhou: ${e.message}")
                }
            }
        }
    }

    private lateinit var webView: WebView

    @SuppressLint("SetJavaScriptEnabled")
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        instancia = this
        setContentView(R.layout.activity_main)

        // GANDI DESATIVADO (02/09/2026) — achado real testando no aparelho
        // físico: mesmo chamando numa thread separada (ver GandiHelper.kt),
        // trava a WebView inteira (tela preta, nunca carrega). Não é mais
        // necessário de qualquer forma: o bloqueio de instalação que isso
        // tentava resolver já foi destravado por outro caminho (keystore de
        // desenvolvedor da Gertec, ver network_security_config e o
        // signingConfig em app/build.gradle.kts). Deixado comentado, não
        // removido, pra não perder o código se algum dia investigarmos o
        // travamento a fundo.
        // GandiHelper.tentarLiberarInstalacao(this)

        // Terminal fixo de bancada — nunca apaga a tela sozinho (decisão já
        // confirmada também nas Configurações do próprio aparelho, isso é
        // reforço do lado do app).
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        webView = findViewById(R.id.webview)
        webView.settings.javaScriptEnabled = true
        webView.settings.domStorageEnabled = true // localStorage — a sessão/token do site depende disso
        webView.settings.databaseEnabled = true

        // Achado real testando reboot no aparelho físico (03/09/2026): logo
        // depois de ligar, o app já sobe (BootReceiver/Home persistente),
        // mas o WiFi às vezes ainda não terminou de conectar — o loadUrl()
        // original falhava silenciosamente e a tela ficava branca pra
        // sempre, sem nenhuma tentativa nova. Terminal de bancada fixo tem
        // que se recuperar sozinho disso (não dá pra contar com alguém
        // puxar o cabo ou reabrir o app manualmente). Reforça também
        // navegação dentro da própria WebView.
        webView.webViewClient = object : WebViewClient() {
            private var tentativasFalha = 0
            override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
                super.onReceivedError(view, request, error)
                if (!request.isForMainFrame) return
                tentativasFalha++
                Log.w("Tipo7WebView", "Falha ao carregar /caixa (tentativa $tentativasFalha): ${error.description}")
                val espera = minOf(2000L * tentativasFalha, 15000L)
                view.postDelayed({ view.loadUrl(baseUrl() + "/caixa") }, espera)
            }
        }

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

        // Trava o terminal na nossa tela — segunda versão (03/09/2026).
        // Achado real testando com usuário no aparelho físico: o simples
        // `startLockTask()` (Screen Pinning) NÃO segura os botões dessa
        // GPOS780 de forma confiável — um toque nos botões some com o app.
        // A trava de verdade no Android é Lock Task via **Device Owner**:
        // aí sim os botões física/logicamente não fazem nada fora do app
        // allowlistado, sem gesto de escape nenhum (só ADB, ver
        // KioskControlReceiver). Continua sendo reforço em cima da
        // segurança de NAVEGAÇÃO já feita (login/hub/modal de perfil) —
        // aquele nível trava o que o site permite acessar; este aqui trava
        // a pessoa dentro do APP em si.
        val dpm = getSystemService(DEVICE_POLICY_SERVICE) as DevicePolicyManager
        val admin = ComponentName(this, AdminReceiver::class.java)
        if (dpm.isDeviceOwnerApp(packageName)) {
            try {
                dpm.setLockTaskPackages(admin, arrayOf(packageName))
                // Nos torna a Home persistente — o aparelho liga e cai
                // direto aqui, sem precisar de escolha manual do usuário
                // nem depender só do BootReceiver.
                val homeFilter = IntentFilter(Intent.ACTION_MAIN).apply {
                    addCategory(Intent.CATEGORY_HOME)
                    addCategory(Intent.CATEGORY_DEFAULT)
                }
                dpm.addPersistentPreferredActivity(admin, homeFilter, ComponentName(this, MainActivity::class.java))
            } catch (e: Exception) {
                Log.w("Tipo7Kiosk", "Configuração de Device Owner falhou: ${e.message}")
            }
        } else {
            // Aparelho ainda não foi promovido a Device Owner (falta rodar
            // `adb shell dpm set-device-owner br.com.tipo7.caixa/.AdminReceiver`
            // uma vez, só funciona com o aparelho sem nenhuma conta
            // cadastrada). Cai pro Screen Pinning comum como fallback —
            // pior que Lock Task de Device Owner, mas melhor que nada.
            Log.w("Tipo7Kiosk", "App não é Device Owner — usando Screen Pinning comum como fallback")
        }
        try {
            startLockTask()
        } catch (e: Exception) {
            Log.w("Tipo7Kiosk", "startLockTask() falhou: ${e.message}")
        }
    }

    private fun baseUrl(): String =
        if (BuildConfig.DEBUG) BuildConfig.BASE_URL_DEBUG else BuildConfig.BASE_URL_RELEASE

    // Terminal de caixa não deve "sair" do app com o botão voltar do Android
    // — só navega pra trás dentro da própria WebView, se der.
    override fun onBackPressed() {
        if (webView.canGoBack()) webView.goBack() else { /* não faz nada — kiosk */ }
    }

    override fun onDestroy() {
        if (instancia === this) instancia = null
        super.onDestroy()
    }
}
