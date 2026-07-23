'use client'

import { useState } from 'react'
import { Printer, Bluetooth, Loader2, CheckCircle2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import {
  bluetoothDisponivel, conectarImpressora, desconectarImpressora, imprimirTeste,
  type ConexaoImpressora,
} from '@/lib/printerBluetooth'

const ACCENT = '#E8B84B'

interface Props {
  contexto: string // texto que aparece no recibo de teste (ex: nome do evento)
}

// Widget de conectar/testar impressora térmica Bluetooth (BLE).
// Autocontido — guarda a conexão só em memória (Web Bluetooth não persiste
// entre recarregamentos de página; é normal precisar reconectar a cada sessão).
export function ImpressoraBluetooth({ contexto }: Props) {
  const [conexao, setConexao]     = useState<ConexaoImpressora | null>(null)
  const [conectando, setConectando] = useState(false)
  const [imprimindo, setImprimindo] = useState(false)
  const [erro, setErro]           = useState<string | null>(null)

  const suportado = bluetoothDisponivel()

  const handleConectar = async () => {
    setConectando(true); setErro(null)
    try {
      const c = await conectarImpressora()
      setConexao(c)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao conectar na impressora.')
    } finally {
      setConectando(false)
    }
  }

  const handleDesconectar = () => {
    if (conexao) desconectarImpressora(conexao)
    setConexao(null)
  }

  const handleImprimirTeste = async () => {
    if (!conexao) return
    setImprimindo(true); setErro(null)
    try {
      await imprimirTeste(conexao, contexto)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao imprimir. Confira se a impressora ainda está ligada e por perto.')
    } finally {
      setImprimindo(false)
    }
  }

  if (!suportado) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex items-center gap-3">
        <Printer size={16} className="text-[#444] shrink-0" />
        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Esse navegador não suporta impressora Bluetooth. Use o Chrome no Android.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
            style={{ background: conexao ? 'rgba(74,222,128,0.1)' : 'rgba(232,184,75,0.1)' }}
          >
            {conexao
              ? <CheckCircle2 size={15} className="text-green-400" />
              : <Bluetooth size={15} style={{ color: ACCENT }} />}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Impressora térmica
            </p>
            <p className="text-[#555] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {conexao ? `Conectada — ${conexao.device.name ?? 'sem nome'}` : 'Não conectada'}
            </p>
          </div>
        </div>

        {conexao && (
          <button type="button" onClick={handleDesconectar}
            className="text-[#444] hover:text-red-400 transition-colors shrink-0">
            <X size={15} />
          </button>
        )}
      </div>

      {erro && <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

      {!conexao ? (
        <button type="button" onClick={handleConectar} disabled={conectando}
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          {conectando ? <Loader2 size={15} className="animate-spin" /> : <><Bluetooth size={15} /> Conectar impressora</>}
        </button>
      ) : (
        <button type="button" onClick={handleImprimirTeste} disabled={imprimindo}
          className={cn(
            'w-full py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 flex items-center justify-center gap-2',
            'border border-[#222] text-[#aaa] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {imprimindo ? <Loader2 size={15} className="animate-spin" /> : <><Printer size={15} /> Imprimir teste</>}
        </button>
      )}
    </div>
  )
}
