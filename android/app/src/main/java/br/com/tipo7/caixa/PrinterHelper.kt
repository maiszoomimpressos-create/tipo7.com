package br.com.tipo7.caixa

import android.content.Context
import android.graphics.Paint
import android.graphics.Typeface
import android.util.Log
import br.com.gertec.gedi.GEDI
import br.com.gertec.gedi.enums.GEDI_PRNTR_e_Alignment
import br.com.gertec.gedi.enums.GEDI_PRNTR_e_BarCodeType
import br.com.gertec.gedi.interfaces.IPRNTR
import br.com.gertec.gedi.structs.GEDI_PRNTR_st_BarCodeConfig
import br.com.gertec.gedi.structs.GEDI_PRNTR_st_StringConfig
import org.json.JSONArray

// Impressão térmica real via GEDI (impressora embutida da GPOS780).
// Achado no javadoc do pacote SDK 988B (`IPRNTR` dentro de `GEDI`):
//   GEDI.getInstance(ctx).getPRNTR() -> Init() -> DrawXXX (texto/QR/barra)
//   -> Output() (é o Output() que realmente manda pro papel — os Draw* só
//   preenchem um buffer).
//
// Layout espelha gerarComandosUmIngresso() em web/src/lib/rawbtPrint.ts
// (mesmo texto, mesma ordem) — a diferença é que a GEDI não expõe escrita
// de bytes ESC/POS crus, só desenho semântico, então aqui usa
// DrawStringExt (texto) e DrawBarCode (QR nativo, GEDI_PRNTR_e_BarCodeType.
// QR_CODE é suportado na GPOS780 conforme a doc do enum).
//
// 07/09/2026: primeira versão de verdade, ligada na ponte PrinterBridge —
// antes disso só existia testeImpressao() (string fixa, só via ADB). Alturas/
// larguras do QR (moduloQr) são um chute inicial (300x300) — ainda não
// testado no papel físico, ajustar aqui se sair grande/pequeno demais ou
// cortado na borda do rolo.
object PrinterHelper {
    private const val TAG = "Tipo7Printer"

    private fun paint(tamanho: Float, negrito: Boolean, alinhamento: Paint.Align): Paint = Paint().apply {
        textSize = tamanho
        isAntiAlias = true
        textAlign = alinhamento
        if (negrito) typeface = Typeface.DEFAULT_BOLD
    }

    private fun desenharTexto(printer: IPRNTR, texto: String, tamanho: Float = 22f, negrito: Boolean = false, alinhamento: Paint.Align = Paint.Align.LEFT) {
        printer.DrawStringExt(GEDI_PRNTR_st_StringConfig(paint(tamanho, negrito, alinhamento)), texto)
    }

    // Chamado pela ponte JS (PrinterBridge) com um JSON array — mesmo shape
    // de IngressoParaImprimir (rawbtPrint.ts): slotNumber, totalSlots,
    // qrToken, eventoTitle, dataFormatada, eventoLocal, ticketName,
    // portador, cpf. Todos os ingressos da venda num único job (Init ...
    // Output uma vez só), com espaço extra entre vias pra rasgar à mão —
    // mesma lógica de gerarComandosMultiplos().
    fun imprimirIngressos(context: Context, ticketsJson: String) {
        val tickets = JSONArray(ticketsJson)
        val printer = GEDI.getInstance(context).getPRNTR()
        printer.Init()

        for (i in 0 until tickets.length()) {
            val t = tickets.getJSONObject(i)
            val slot = t.optInt("slotNumber", i + 1)
            val total = t.optInt("totalSlots", 1)
            val qr = t.optString("qrToken", "")
            val eventoTitle = t.optString("eventoTitle", "")
            val dataFormatada = if (t.has("dataFormatada") && !t.isNull("dataFormatada")) t.optString("dataFormatada") else null
            val eventoLocal = t.optString("eventoLocal", "")
            val ticketName = t.optString("ticketName", "")
            val portador = t.optString("portador", "")
            val cpf = if (t.has("cpf") && !t.isNull("cpf")) t.optString("cpf") else null

            desenharTexto(printer, "TIPO7.COM", 24f, negrito = true, alinhamento = Paint.Align.CENTER)
            printer.DrawBlankLine(10)
            desenharTexto(printer, "INGRESSO #${slot.toString().padStart(3, '0')}", 30f, negrito = true, alinhamento = Paint.Align.CENTER)
            if (total > 1) desenharTexto(printer, "$slot de $total", 20f, alinhamento = Paint.Align.CENTER)
            printer.DrawBlankLine(10)

            desenharTexto(printer, eventoTitle, 22f, negrito = true)
            if (!dataFormatada.isNullOrBlank()) desenharTexto(printer, dataFormatada)
            if (eventoLocal.isNotBlank()) desenharTexto(printer, eventoLocal)
            printer.DrawBlankLine(6)
            desenharTexto(printer, "--------------------------------")
            desenharTexto(printer, "Tipo: $ticketName")
            desenharTexto(printer, "Portador: ${portador.ifBlank { "Consumidor" }}")
            if (!cpf.isNullOrBlank()) desenharTexto(printer, "CPF: $cpf")
            desenharTexto(printer, "--------------------------------")
            printer.DrawBlankLine(6)

            printer.DrawBarCode(
                GEDI_PRNTR_st_BarCodeConfig(GEDI_PRNTR_e_BarCodeType.QR_CODE, 300, 300, GEDI_PRNTR_e_Alignment.CENTER, 0),
                qr,
            )
            desenharTexto(printer, "tipo7.com", 20f, alinhamento = Paint.Align.CENTER)

            // Espaço extra entre vias (rasgar à mão). Achado real
            // (07/09/2026, teste físico na GPOS780): 40 não bastava — o
            // ponto de rasgar ficava em cima do próprio QR, cortando ele.
            // Aumentado bastante pra garantir folga de verdade abaixo do QR
            // antes do ponto de rasgo.
            printer.DrawBlankLine(if (i == tickets.length() - 1) 200 else 220)
        }

        printer.Output()
        Log.i(TAG, "Impressão de ${tickets.length()} ingresso(s) enviada.")
    }

    fun testeImpressao(context: Context) {
        try {
            val printer = GEDI.getInstance(context).getPRNTR()
            printer.Init()
            desenharTexto(printer, "Tipo7 - teste de impressao")
            desenharTexto(printer, "GPOS780 - GEDI OK")
            printer.DrawBlankLine(60)
            printer.Output()
            Log.i(TAG, "Teste de impressão enviado com sucesso.")
        } catch (e: Throwable) {
            Log.w(TAG, "Teste de impressão falhou: ${e.message}", e)
        }
    }
}
