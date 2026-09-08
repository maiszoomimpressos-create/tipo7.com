package br.com.tipo7.caixa

import android.annotation.SuppressLint
import android.app.AlertDialog
import android.app.admin.DevicePolicyManager
import android.content.ComponentName
import android.content.Intent
import android.content.IntentFilter
import android.os.Bundle
import android.util.Log
import android.view.WindowManager
import android.webkit.CookieManager
import android.webkit.ConsoleMessage
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebStorage
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
        // Impressão térmica real via GEDI (ver PrinterHelper.kt/PrinterBridge.kt
        // e web/src/lib/gediPrint.ts) — achado real 07/09/2026: até aqui só
        // existia um teste manual via ADB (PrintTestReceiver), a venda de
        // ingresso de verdade nunca chamava a impressora física.
        webView.addJavascriptInterface(PrinterBridge(applicationContext, webView), "PrinterBridge")

        webView.loadUrl(baseUrl() + "/caixa")

        // Botão nativo (fora da WebView, ver activity_main.xml) — funciona
        // mesmo se a página web travar/ficar em branco. Sem isso, a única
        // forma de recuperar um terminal travado era ADB (inviável no
        // campo). Discreto de propósito: não é pra ser usado no dia a dia,
        // só quando algo trava.
        findViewById<android.widget.TextView>(R.id.botaoMenu).setOnClickListener {
            mostrarMenuRecuperacao()
        }

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
        // Achado real 06/09/2026: sem essa checagem, uma desativação via ADB
        // (KioskControlReceiver) só durava até o app reiniciar sozinho — o
        // onCreate reaplicava o lock task incondicionalmente. Agora só
        // reativa se a preferência persistida (Kiosk.prefs) continuar
        // "ativo" — ver KIOSK_ATIVAR/KIOSK_DESATIVAR pra alternar.
        if (Kiosk.ativo(this)) {
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
        } else {
            Log.w("Tipo7Kiosk", "Kiosk desativado (flag persistida) — não travando a tela desta vez")
        }
    }

    private fun baseUrl(): String =
        if (BuildConfig.DEBUG) BuildConfig.BASE_URL_DEBUG else BuildConfig.BASE_URL_RELEASE

    // Menu nativo de recuperação — pedido do usuário 06/09/2026 depois de um
    // terminal travar numa tela em branco sem cabo/ADB por perto pra
    // recuperar. As duas opções cobrem os 2 tipos de trava reais que já
    // vimos: rede/servidor com problema (Recarregar resolve) e sessão presa
    // num caixa errado (Desconectar limpa e volta pro login).
    private fun mostrarMenuRecuperacao() {
        AlertDialog.Builder(this)
            .setTitle("Terminal Tipo7")
            .setItems(arrayOf("Recarregar", "Desconectar (sair da conta)", "Cancelar")) { _, which ->
                when (which) {
                    0 -> recarregar()
                    1 -> desconectar()
                }
            }
            .show()
    }

    private fun recarregar() {
        webView.loadUrl(baseUrl() + "/caixa")
    }

    // Limpa cookies E localStorage — a sessão do site pode estar em
    // qualquer um dos dois (ver web/src/lib/auth/session.ts), limpar só um
    // não garante logout de verdade.
    private fun desconectar() {
        CookieManager.getInstance().removeAllCookies(null)
        WebStorage.getInstance().deleteAllData()
        webView.clearCache(true)
        recarregar()
    }

    // Terminal de caixa nunca navega "pra trás" pelo histórico do WebView —
    // só pelos próprios botões da tela (ex: "Nova venda").
    //
    // Achado real (07/09/2026): a versão antiga chamava webView.goBack()
    // quando havia histórico — o site troca de tela inteiramente por
    // ESTADO do React (etapa), não por navegação de URL de verdade, mas
    // ainda empurra entradas no histórico em alguns pontos (router.push do
    // Next.js). Resultado real visto pelo usuário: apertar voltar
    // reabria a TELA DE IMPRESSÃO de uma venda já finalizada — nenhum
    // fluxo esperava isso, deixava o operador confuso e podia reimprimir
    // sem querer. Kiosk nunca deveria expor navegação de histórico pro
    // botão físico de qualquer forma — sempre no-op agora.
    override fun onBackPressed() {
        // Propositalmente vazio.
    }

    override fun onDestroy() {
        if (instancia === this) instancia = null
        super.onDestroy()
    }
}
