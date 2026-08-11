// Impressão térmica direta do PC via Web Serial — pro caixa que roda no
// Windows/Mac/Linux com Chrome/Edge e tem (ou ganhou via dongle USB)
// Bluetooth pareado direto com a impressora, sem depender de celular
// nenhum. Complementa lib/rawbtPrint.ts (que é pro caso do celular da
// Segunda Tela ser quem tem a impressora conectada) — os dois reusam o
// mesmo builder ESC/POS (gerarComandosMultiplos), só muda o transporte.
//
// Por que Web Serial e não Web Bluetooth: impressoras térmicas baratas tipo
// KP-1025 falam Bluetooth Classic (perfil SPP), que a Web Bluetooth API não
// alcança (só enxerga BLE). Mas quando você pareia esse tipo de dispositivo
// no Bluetooth do próprio sistema operacional, o Windows/Mac cria uma porta
// COM virtual pra ele — e é isso que a Web Serial API acessa.
//
// Diferença importante pro RawBT: aqui a permissão é concedida UMA VEZ
// (`navigator.serial.requestPort()`, precisa de gesto do usuário — só na
// primeira vez) e persiste entre sessões. Depois disso, `getPorts()` e
// escrever no port já aberto NÃO exigem gesto nenhum — dá pra chamar de
// dentro de qualquer código assíncrono (resposta de API, timer etc.), ao
// contrário do intent:// do RawBT que o Chrome bloqueia toda vez sem gesto
// direto (achado real, 11/08/2026 — ver SegundaTelaClient.tsx).

// ── Tipos ambient da Web Serial API ─────────────────────────────────────────
// TypeScript/lib.dom ainda não cobre essa API nativamente (spec relativamente
// nova, Chromium-only). Declaração mínima só com o que este arquivo usa.
interface SerialPortInfo {
  usbVendorId?: number
  usbProductId?: number
}

interface SerialOptions {
  baudRate: number
}

interface SerialPort {
  readonly readable: ReadableStream<Uint8Array> | null
  readonly writable: WritableStream<Uint8Array> | null
  open(options: SerialOptions): Promise<void>
  close(): Promise<void>
  getInfo(): SerialPortInfo
}

interface Serial extends EventTarget {
  requestPort(options?: { filters?: SerialPortInfo[] }): Promise<SerialPort>
  getPorts(): Promise<SerialPort[]>
}

declare global {
  interface Navigator {
    serial?: Serial
  }
}

// Baud rate mais comum entre impressoras térmicas ESC/POS Bluetooth-serial
// baratas (KP-1025 e clones parecidos) — não confirmado pra todo modelo;
// se não imprimir nada legível, esse é o primeiro parâmetro a tentar trocar
// (9600 → 19200 → 115200, valores usuais nesse tipo de chip).
const BAUD_RATE = 9600

// Mantém a porta já aberta nesta aba — evita reabrir/reconectar a cada
// impressão (abrir a porta de novo com ela já aberta dá erro no Chrome).
let portaAtual: SerialPort | null = null

export function serialSuportado(): boolean {
  return typeof navigator !== 'undefined' && 'serial' in navigator && !!navigator.serial
}

// Só funciona chamado em resposta direta a um clique/toque do usuário —
// é a ÚNICA etapa deste arquivo com essa exigência (mostra o seletor
// nativo de porta do Chrome). Uma vez concedida, a permissão persiste.
export async function conectarImpressoraSerial(): Promise<SerialPort> {
  if (!navigator.serial) throw new Error('Este navegador não suporta Web Serial (use Chrome ou Edge no computador).')
  const porta = await navigator.serial.requestPort()
  await porta.open({ baudRate: BAUD_RATE })
  portaAtual = porta
  return porta
}

// Tenta retomar uma porta já autorizada antes, sem pedir permissão de novo
// — chamado ao carregar a tela, silenciosamente. Se a impressora já foi
// conectada uma vez neste navegador, volta a funcionar sozinho. Retorna
// null se nunca foi autorizada nenhuma porta (aí precisa do botão manual).
export async function reconectarImpressoraSerial(): Promise<SerialPort | null> {
  if (!navigator.serial) return null
  if (portaAtual) return portaAtual
  const portas = await navigator.serial.getPorts()
  if (portas.length === 0) return null
  const porta = portas[0]
  try {
    await porta.open({ baudRate: BAUD_RATE })
    portaAtual = porta
    return porta
  } catch {
    // Porta já estava aberta (outra aba?) ou indisponível no momento —
    // não trata como erro fatal, só não fica com impressora conectada.
    return null
  }
}

export function desconectarImpressoraSerial(): void {
  if (!portaAtual) return
  portaAtual.close().catch(() => {})
  portaAtual = null
}

export function impressoraSerialConectada(): boolean {
  return portaAtual !== null
}

// Escreve os bytes ESC/POS direto na porta — mesmo formato que
// gerarComandosMultiplos() de rawbtPrint.ts já produz, sem base64/intent
// nenhum (isso era só necessidade do RawBT). Sem gesto do usuário exigido
// aqui, desde que a porta já esteja aberta.
export async function imprimirViaSerial(bytes: Uint8Array): Promise<void> {
  const porta = portaAtual ?? await reconectarImpressoraSerial()
  if (!porta || !porta.writable) {
    throw new Error('Nenhuma impressora conectada via Web Serial. Configure em "Configurar impressão".')
  }
  const writer = porta.writable.getWriter()
  try {
    await writer.write(bytes)
  } finally {
    writer.releaseLock()
  }
}
