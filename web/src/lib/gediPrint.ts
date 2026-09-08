// Impressão térmica real via GEDI — impressora embutida da GPOS780, ponte
// JS↔Android (PrinterBridge, ver android/app/src/main/java/br/com/tipo7/
// caixa/PrinterBridge.kt + PrinterHelper.kt). Só existe dentro do app
// nativo (ver isNativeCaixaApp()).
//
// Diferença importante pro RawBT/TipPrint/Web Serial (rawbtPrint.ts,
// webSerialPrint.ts): aqueles mandam bytes ESC/POS crus pra impressora. A
// GEDI não expõe escrita de bytes diretos — só uma API de desenho
// semântico (DrawStringExt/DrawBarCode/Output). Por isso aqui reusa o
// mesmo shape de dados (IngressoParaImprimir) em vez dos bytes já
// prontos — quem desenha o layout é o lado Kotlin (PrinterHelper.kt),
// espelhando o mesmo texto/QR que rawbtPrint.ts gera pros outros formatos.
import type { IngressoParaImprimir } from './rawbtPrint'

interface PrinterBridgeGlobal {
  imprimirIngressos(ticketsJson: string, callbackId: string): void
}

declare global {
  interface Window {
    PrinterBridge?: PrinterBridgeGlobal
    Tipo7ImpressaoCallback?: (callbackId: string, resultJson: string) => void
  }
}

export function gediDisponivel(): boolean {
  return typeof window !== 'undefined' && typeof window.PrinterBridge !== 'undefined'
}

// Registro global único do callback (mesmo padrão de CobrancaBridge no
// lado Android) — a ponte nativa chama window.Tipo7ImpressaoCallback(id,
// json) de volta; aqui resolve/rejeita a promise pendente daquele id.
let callbackRegistrado = false
const pendentes = new Map<string, { resolve: () => void; reject: (e: Error) => void }>()

function registrarCallbackGlobal() {
  if (callbackRegistrado) return
  callbackRegistrado = true
  window.Tipo7ImpressaoCallback = (callbackId, resultJson) => {
    const pendente = pendentes.get(callbackId)
    if (!pendente) return
    pendentes.delete(callbackId)
    try {
      const resultado = JSON.parse(resultJson) as { ok: boolean; erro?: string }
      if (resultado.ok) pendente.resolve()
      else pendente.reject(new Error(resultado.erro || 'Falha ao imprimir'))
    } catch {
      pendente.reject(new Error('Resposta inválida do app nativo ao imprimir'))
    }
  }
}

export function imprimirViaGEDI(tickets: IngressoParaImprimir[]): Promise<void> {
  if (!gediDisponivel()) return Promise.reject(new Error('Impressora do terminal não disponível (app desatualizado?)'))
  registrarCallbackGlobal()
  const callbackId = `print-${Date.now()}-${Math.random().toString(36).slice(2)}`
  return new Promise((resolve, reject) => {
    pendentes.set(callbackId, { resolve, reject })
    window.PrinterBridge!.imprimirIngressos(JSON.stringify(tickets), callbackId)
  })
}
