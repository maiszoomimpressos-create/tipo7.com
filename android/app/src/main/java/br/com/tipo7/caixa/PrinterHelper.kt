package br.com.tipo7.caixa

import android.content.Context
import android.graphics.Paint
import android.util.Log
import br.com.gertec.gedi.GEDI
import br.com.gertec.gedi.structs.GEDI_PRNTR_st_StringConfig

// Teste de impressão via GEDI (impressora térmica embutida da GPOS780).
// Achado no javadoc do pacote SDK 988B (`PRNTR` dentro de `GEDI`):
//   GEDI.getInstance(ctx).getPRNTR() -> Init() -> DrawStringExt(config, texto)
//   -> Output() (é o Output() que realmente manda pro papel — os Draw* só
//   preenchem um buffer).
object PrinterHelper {
    private const val TAG = "Tipo7Printer"

    fun testeImpressao(context: Context) {
        try {
            // Chamado explicitamente como getPRNTR() (não a propriedade
            // sintética do Kotlin) — nome todo maiúsculo confunde a regra
            // de decapitalização do Kotlin (viraria `.pRNTR`, não `.prntr`).
            val printer = GEDI.getInstance(context).getPRNTR()
            printer.Init()

            val paint = Paint().apply {
                textSize = 32f
                isAntiAlias = true
            }
            printer.DrawStringExt(GEDI_PRNTR_st_StringConfig(paint), "Tipo7 - teste de impressao")
            printer.DrawStringExt(GEDI_PRNTR_st_StringConfig(paint), "GPOS780 - GEDI OK")
            printer.DrawBlankLine(60)
            printer.Output()
            Log.i(TAG, "Teste de impressão enviado com sucesso.")
        } catch (e: Throwable) {
            Log.w(TAG, "Teste de impressão falhou: ${e.message}", e)
        }
    }
}
