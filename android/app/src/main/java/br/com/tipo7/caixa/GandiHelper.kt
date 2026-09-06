package br.com.tipo7.caixa

import android.content.Context
import android.util.Log
import br.com.gertec.gandi.Gandi
import kotlin.concurrent.thread

// Tentativa de destravar instalação de app na GPOS780 via API GANDI —
// ver docs/maquininha-gpos780-levantamento-requisitos.md, seção
// "Investigação a fundo do bloqueio de instalação (02/09/2026)". Confirmado
// nessa investigação que o bloqueio (INSTALL_PARSE_FAILED_INCONSISTENT_
// CERTIFICATES em qualquer app, inclusive o nosso, assinado certinho) não é
// restrição padrão do Android — é hardening próprio do firmware Gertec/
// Wiseasy. Os dois métodos abaixo, achados no javadoc do pacote SDK 988B
// (`IGandi`), parecem endereçar exatamente isso:
//
//   CanInstallUnknownAppsEnabled(pacote, true) — libera instalação de um
//   pacote específico. EnableDebugInstallMode(true) — "instala qualquer
//   app (debug image only)" — nosso aparelho é userdebug, bate certinho.
//
// PROBLEMA CIRCULAR AINDA NÃO RESOLVIDO: pra esse código rodar, o app já
// precisa estar instalado no aparelho — e é exatamente isso que está
// bloqueado. Ou seja, isso só serve de algo em 2 cenários:
//  (a) alguém instalar manualmente uma vez (ex: via cerimonial/homologação
//      no portal Gertec, ou um caminho ainda não achado), e a partir daí
//      esse código já deixa reinstalações/updates futuros mais fáceis; ou
//  (b) os métodos exigirem só "privilégio de app assinado pela Gertec" pra
//      *funcionar* (não pra *instalar*), e a instalação em si passar por
//      outro motivo qualquer — não confirmado, só temos os métodos, não a
//      resposta de quando eles realmente funcionam.
// Registrado e chamado de qualquer forma, sem custo real: se falhar
// (esperado, provavelmente por falta de "Customer/Enhanced privilege"),
// só loga e segue — não trava o app.
object GandiHelper {
    private const val TAG = "Tipo7Gandi"

    // Achado real (02/09/2026, testado no aparelho físico): chamar isso
    // direto na thread principal do onCreate TRAVA a tela inteira (preta,
    // sem log nenhum) — Gandi.getInstance()/os métodos ficam bloqueados
    // esperando resposta de um serviço de sistema que demora/nunca responde
    // nesse cenário. Roda numa thread separada agora, sem nunca travar a UI.
    fun tentarLiberarInstalacao(context: Context) {
        thread(name = "GandiHelper") {
            tentarLiberarInstalacaoBloqueante(context.applicationContext)
        }
    }

    private fun tentarLiberarInstalacaoBloqueante(context: Context) {
        try {
            val gandi = Gandi.getInstance(context)
            try {
                gandi.EnableDebugInstallMode(true)
                Log.i(TAG, "EnableDebugInstallMode(true) — OK, sem exceção.")
            } catch (e: Exception) {
                Log.w(TAG, "EnableDebugInstallMode(true) falhou: ${e.message}", e)
            }
            try {
                gandi.CanInstallUnknownAppsEnabled(context.packageName, true)
                Log.i(TAG, "CanInstallUnknownAppsEnabled(${context.packageName}, true) — OK, sem exceção.")
            } catch (e: Exception) {
                Log.w(TAG, "CanInstallUnknownAppsEnabled falhou: ${e.message}", e)
            }
        } catch (e: Throwable) {
            // Gandi.getInstance() em si pode falhar (ex: rodando fora da
            // GPOS780, tipo no emulador) — não deve nunca derrubar o app.
            Log.w(TAG, "Gandi.getInstance() falhou (normal fora da GPOS780 real): ${e.message}")
        }
    }
}
