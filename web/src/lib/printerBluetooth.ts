// Conexão com impressora térmica via Web Bluetooth.
//
// IMPORTANTE: isso só funciona com impressoras BLE (Bluetooth de baixa energia).
// A maioria das impressoras de cupom fiscal "de verdade" usa Bluetooth clássico
// (SPP), que o navegador não consegue acessar de jeito nenhum — não é uma
// limitação nossa, é da própria API do navegador. Já as mini impressoras
// baratas tipo "instant printing" (58mm, sem fio) costumam ser BLE, e são
// essas que este código atende.
//
// Como não sabemos ainda o UUID exato do serviço/característica da impressora
// específica que será comprada, tentamos os padrões mais comuns usados por
// esse tipo de hardware barato — e guardamos os serviços encontrados pra
// diagnóstico, caso a impressão de teste não funcione de primeira.
'use client'

const SERVICE_UUIDS_CANDIDATOS = [
  '0000ae30-0000-1000-8000-00805f9b34fb', // comum em "cat printers" chinesas
  '000018f0-0000-1000-8000-00805f9b34fb', // outro padrão comum em clones
  '6e400001-b5a3-f393-e0a9-e50e24dcca9e', // Nordic UART Service (ponte serial genérica)
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', // ponte serial genérica (outro fabricante comum)
]

export interface ConexaoImpressora {
  device:         BluetoothDevice
  characteristic: BluetoothRemoteGATTCharacteristic
  servicos:       string[] // todos os serviços GATT encontrados — útil pra diagnóstico
}

export function bluetoothDisponivel(): boolean {
  return typeof navigator !== 'undefined' && 'bluetooth' in navigator
}

export async function conectarImpressora(): Promise<ConexaoImpressora> {
  if (!bluetoothDisponivel()) {
    throw new Error('Este navegador não suporta Bluetooth. No celular, use o Chrome no Android — iPhone não é compatível.')
  }

  const device = await navigator.bluetooth.requestDevice({
    acceptAllDevices: true,
    optionalServices: SERVICE_UUIDS_CANDIDATOS,
  })

  if (!device.gatt) throw new Error('Este dispositivo não suporta conexão GATT (provavelmente não é BLE).')

  const server = await device.gatt.connect()
  const services = await server.getPrimaryServices()

  const servicos: string[] = []
  let characteristic: BluetoothRemoteGATTCharacteristic | null = null

  for (const service of services) {
    servicos.push(service.uuid)
    const chars = await service.getCharacteristics()
    for (const c of chars) {
      // Usa a primeira característica que aceita escrita — é por ela que os
      // comandos de impressão são enviados.
      if (!characteristic && (c.properties.write || c.properties.writeWithoutResponse)) {
        characteristic = c
      }
    }
  }

  if (!characteristic) {
    throw new Error(`Conectou, mas nenhuma característica de escrita foi encontrada. Serviços vistos: ${servicos.join(', ') || 'nenhum'}`)
  }

  return { device, characteristic, servicos }
}

export function desconectarImpressora(conexao: ConexaoImpressora) {
  conexao.device.gatt?.disconnect()
}

// Monta um payload ESC/POS simples: inicializa, escreve texto, pula linhas, corta (se suportado)
function montarPayload(linhas: string[]): Uint8Array {
  const ESC = 0x1b
  const GS  = 0x1d
  const bytes: number[] = [ESC, 0x40] // ESC @ — inicializa impressora
  const texto = linhas.join('\n') + '\n\n\n'
  for (const b of new TextEncoder().encode(texto)) bytes.push(b)
  bytes.push(GS, 0x56, 0x00) // GS V 0 — corta o papel (ignorado se a impressora não suportar)
  return new Uint8Array(bytes)
}

async function enviar(conexao: ConexaoImpressora, payload: Uint8Array) {
  // BLE tem limite de tamanho por escrita — manda em pedaços pequenos
  const CHUNK = 180
  for (let i = 0; i < payload.length; i += CHUNK) {
    const pedaco = payload.slice(i, i + CHUNK)
    if (conexao.characteristic.properties.writeWithoutResponse) {
      await conexao.characteristic.writeValueWithoutResponse(pedaco)
    } else {
      await conexao.characteristic.writeValue(pedaco)
    }
  }
}

export async function imprimirTeste(conexao: ConexaoImpressora, contexto: string): Promise<void> {
  await enviar(conexao, montarPayload([
    'TIPO7 - TESTE DE IMPRESSAO',
    '----------------------------',
    contexto,
    new Date().toLocaleString('pt-BR'),
    '----------------------------',
    'Se voce esta lendo isso, a',
    'impressora esta conectada',
    'corretamente.',
  ]))
}

export async function imprimirRecibo(conexao: ConexaoImpressora, linhas: string[]): Promise<void> {
  await enviar(conexao, montarPayload(linhas))
}
