// Impressão térmica automática via app TipPrint (nosso próprio app Android,
// br.com.tipprint) — dispara direto no app via intent: URL, sem passar pelo
// diálogo de impressão do Android (o que window.print() sempre abre).
//
// Até 13/08/2026 isso usava o RawBT (app de terceiros, ru.a402d.rawbtprinter)
// com o mesmo mecanismo de intent: URL — trocado pro nosso próprio app pra
// não depender de app de terceiro (pareamento à parte, sem controle sobre
// bugs/atualizações dele). O TipPrint Android ganhou um link equivalente
// (PrintLinkActivity, scheme "tipprint") que aceita o mesmo formato de bytes
// base64 e imprime na impressora já configurada no app. Formato do link
// baseado no que o RawBT usa (DemoRawBtPrinter, github.com/402d/DemoRawBtPrinter):
//   intent:base64,<BASE64>#Intent;scheme=tipprint;package=br.com.tipprint;end;
// Bytes ESC/POS têm valores 128-255 (fora do ASCII puro), por isso SEMPRE
// base64 aqui.
//
// Só funciona em Android com o app TipPrint instalado e a impressora já
// configurada nele (Bluetooth/USB/rede — telas do próprio app, ver
// memória project_impressao_termica_mobile.md) — não tem fallback
// silencioso: se o app não estiver instalado, o Android mostra a Play
// Store ou não faz nada, dependendo do navegador.

const TIPPRINT_PACKAGE = 'br.com.tipprint'

// ESC/POS não é UTF-8 — cada impressora usa uma codepage própria (PC437,
// PC860 etc.) e não dá pra saber de antemão qual a KP-1025 aceita sem
// mandar o comando de seleção de codepage (arriscado, cada clone responde
// diferente). Mais seguro: tirar os acentos e imprimir só ASCII puro.
function removerAcentos(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\x20-\x7e]/g, '?') // qualquer coisa fora do ASCII imprimível vira '?' em vez de lixo
}

function bytesToBase64(bytes: number[]): string {
  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return btoa(binary)
}

class EscPosBuilder {
  private bytes: number[] = []

  raw(...b: number[]) { this.bytes.push(...b); return this }

  text(s: string) {
    const ascii = removerAcentos(s)
    for (let i = 0; i < ascii.length; i++) this.bytes.push(ascii.charCodeAt(i) & 0xff)
    return this
  }

  nl(n = 1) { for (let i = 0; i < n; i++) this.bytes.push(0x0a); return this }

  init() { return this.raw(0x1b, 0x40) }
  alinhar(a: 'esquerda' | 'centro' | 'direita') {
    return this.raw(0x1b, 0x61, a === 'esquerda' ? 0x00 : a === 'centro' ? 0x01 : 0x02)
  }
  negrito(on: boolean) { return this.raw(0x1b, 0x45, on ? 0x01 : 0x00) }
  tamanho(dobrado: boolean) { return this.raw(0x1d, 0x21, dobrado ? 0x11 : 0x00) }

  // QR code nativo da impressora (GS ( k) — Epson ESC/POS padrão, clonado
  // por praticamente todo chip ESC/POS barato. Bem mais confiável que
  // converter o QR em bitmap na mão.
  qrCode(data: string, moduloTamanho = 6) {
    const dataBytes: number[] = []
    // token só tem caracteres ASCII normalmente (uuid/hex) — TextEncoder
    // cobre o caso geral sem risco.
    for (const byte of new TextEncoder().encode(data)) dataBytes.push(byte)

    // 1) Modelo (modelo 2 — o mais compatível)
    this.raw(0x1d, 0x28, 0x6b, 0x04, 0x00, 0x31, 0x41, 0x32, 0x00)
    // 2) Tamanho do módulo
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x43, moduloTamanho)
    // 3) Correção de erro — L (mínima) em vez de M. Achado real
    // (11/08/2026, teste ao vivo): impressora clone barata (KP-1025)
    // mandava "2QR CREAT ERR!" no papel a partir do 2º QR de uma tirada
    // com vários ingressos — o microcontrolador dela não aguenta gerar
    // QRs seguidos rápido demais. L reduz o dado redundante a codificar,
    // o suficiente pra aliviar o processamento (o qrToken já é curto,
    // não perde legibilidade real por usar correção mínima).
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x45, 0x30)
    // 4) Armazena os dados
    const len = dataBytes.length + 3
    this.raw(0x1d, 0x28, 0x6b, len & 0xff, (len >> 8) & 0xff, 0x31, 0x50, 0x30, ...dataBytes)
    // 5) Imprime o símbolo armazenado
    this.raw(0x1d, 0x28, 0x6b, 0x03, 0x00, 0x31, 0x51, 0x30)
    return this
  }

  build(): number[] { return this.bytes }
}

export interface IngressoParaImprimir {
  slotNumber:  number
  totalSlots:  number
  qrToken:     string
  eventoTitle: string
  dataFormatada: string | null
  eventoLocal: string
  ticketName:  string
  portador:    string
  cpf?:        string
}

// Gera os comandos de UM ingresso — usado tanto sozinho quanto concatenado
// (várias vias em sequência viram um único disparo de impressão, ver
// gerarComandosMultiplos).
function gerarComandosUmIngresso(b: EscPosBuilder, t: IngressoParaImprimir) {
  b.alinhar('centro').negrito(true).text('TIPO7.COM').nl().negrito(false).nl()

  b.tamanho(true)
  b.text(`INGRESSO #${String(t.slotNumber).padStart(3, '0')}`).nl()
  b.tamanho(false)
  if (t.totalSlots > 1) b.text(`${t.slotNumber} de ${t.totalSlots}`).nl()
  b.nl()

  b.alinhar('esquerda')
  b.negrito(true).text(t.eventoTitle).nl().negrito(false)
  if (t.dataFormatada) b.text(t.dataFormatada).nl()
  if (t.eventoLocal) b.text(t.eventoLocal).nl()
  b.nl()
  b.text('--------------------------------').nl()
  b.text(`Tipo: ${t.ticketName}`).nl()
  b.text(`Portador: ${t.portador || 'Consumidor'}`).nl()
  if (t.cpf) b.text(`CPF: ${t.cpf}`).nl()
  b.text('--------------------------------').nl()
  b.nl()

  b.alinhar('centro').qrCode(t.qrToken).nl()
  b.text('tipo7.com').nl()
  b.alinhar('esquerda')
}

// Concatena todos os ingressos de uma venda em UM único job de impressão —
// disparar vários intents em sequência não é confiável (cada um troca o
// foco pro RawBT e não dá pra garantir que o próximo já teria efeito antes
// do usuário voltar pro Tipo7), então em vez disso empilha tudo num só
// buffer, com espaço extra entre as vias pra rasgar à mão (a KP-1025 é
// impressora portátil, sem guilhotina automática).
export function gerarComandosMultiplos(tickets: IngressoParaImprimir[]): Uint8Array {
  const b = new EscPosBuilder()
  b.init()
  tickets.forEach((t, i) => {
    gerarComandosUmIngresso(b, t)
    // Espaço extra entre vias (era 6 linhas, pensado só pra rasgar à mão).
    // Achado real (11/08/2026): também funciona como o único "delay" que
    // dá pra encaixar num fluxo ESC/POS sem comando de esperar tempo real
    // — cada linha em branco é o motor avançando papel de verdade, dá
    // folga pro microcontrolador da impressora terminar de processar o QR
    // anterior antes do próximo comando de QR chegar (ver nota em qrCode()
    // acima sobre o "2QR CREAT ERR!").
    b.nl(i === tickets.length - 1 ? 3 : 20)
  })
  return new Uint8Array(b.build())
}

// Dispara a impressão via TipPrint (app próprio) — sem diálogo do Android.
// Precisa ser chamado em resposta direta a uma ação do usuário/fluxo (não em
// background silencioso) pra não ser bloqueado como pop-up/navegação indesejada.
export function imprimirViaTipPrint(bytes: Uint8Array): void {
  const b64 = bytesToBase64(Array.from(bytes))
  const url = `intent:base64,${encodeURIComponent(b64)}#Intent;scheme=tipprint;package=${TIPPRINT_PACKAGE};end;`
  window.location.href = url
}
