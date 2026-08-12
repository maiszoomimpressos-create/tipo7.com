'use client'

import { useEffect, useState, useCallback } from 'react'
import { Printer, Download, Loader2, CheckCircle2, ExternalLink, MonitorSmartphone, Send } from 'lucide-react'
import { statusPrintServer, imprimirTesteServidor, type StatusPrintServer } from '@/lib/printServerClient'

const ACCENT = '#E8B84B'
const ZIP_URL   = '/downloads/impressao/RawBtsPrintServer.zip'
const PAINEL_URL = 'http://localhost:8080'

// Widget de status do RawBts PrintServer — usado tanto na Bilheteria quanto
// no Estacionamento. Só mostra se o app está rodando neste PC e qual
// impressora está ativa; a ESCOLHA da impressora acontece dentro do próprio
// painel do PrintServer (localhost:8080 tem sua UI própria de listar/clicar/
// conectar, servida pelo PrintServer.cs) — é um passo único de instalação,
// não algo que este componente precisa replicar. Aqui só linkamos pra lá.
export function PrintServerPanel() {
  const [checando, setChecando] = useState(true)
  const [status, setStatus]     = useState<StatusPrintServer | null>(null)
  // Teste do papel — pra confirmar a conexão física ANTES de abrir o caixa
  // (pedido do usuário, 11/08/2026): estado só de sessão, não persiste, é só
  // feedback visual imediato do clique.
  const [testando, setTestando] = useState(false)
  const [testeResultado, setTesteResultado] = useState<'ok' | 'erro' | null>(null)

  const atualizar = useCallback(async () => {
    setStatus(await statusPrintServer())
    setChecando(false)
  }, [])

  useEffect(() => {
    atualizar()
    // Repolling leve — cobre tanto "usuário acabou de instalar e abrir o
    // app" quanto "impressora desconectou/reconectou sozinha" (watchdog do
    // PrintServer), sem precisar recarregar a página.
    const id = setInterval(atualizar, 4000)
    return () => clearInterval(id)
  }, [atualizar])

  async function handleTestar() {
    setTestando(true); setTesteResultado(null)
    try {
      await imprimirTesteServidor('TIPO7 - TESTE')
      setTesteResultado('ok')
    } catch {
      setTesteResultado('erro')
    } finally {
      setTestando(false)
    }
  }

  if (checando) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex items-center gap-2.5 text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <Loader2 size={14} className="animate-spin" /> Procurando o RawBts PrintServer neste computador...
      </div>
    )
  }

  if (!status) {
    return (
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: 'rgba(232,184,75,0.1)' }}>
            <MonitorSmartphone size={15} style={{ color: ACCENT }} />
          </div>
          <div>
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>PrintServer não encontrado</p>
            <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Instale o app nesse computador pra imprimir direto na impressora térmica.</p>
          </div>
        </div>
        <ol className="text-[#777] text-xs space-y-1 list-decimal list-inside" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <li>Baixe e abra o instalador (botão abaixo)</li>
          <li>Pareie a impressora no Bluetooth do Windows se for o caso (PIN padrão 0000)</li>
          <li>O instalador abre <code>localhost:8080</code> sozinho — clique na sua impressora lá</li>
          <li>Volte aqui e clique em &quot;verificar de novo&quot;</li>
        </ol>
        <a href={ZIP_URL} download
          className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#070707] flex items-center justify-center gap-2"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}>
          <Download size={15} /> Baixar RawBts PrintServer
        </a>
        <button type="button" onClick={atualizar}
          className="w-full py-2 rounded-xl text-xs font-medium border border-[#222] text-[#888] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Já instalei, verificar de novo
        </button>
      </div>
    )
  }

  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ background: status.connected ? 'rgba(74,222,128,0.1)' : 'rgba(232,184,75,0.1)' }}>
            {status.connected
              ? <CheckCircle2 size={15} className="text-green-400" />
              : <Printer size={15} style={{ color: ACCENT }} />}
          </div>
          <div className="min-w-0">
            <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>PrintServer detectado</p>
            <p className="text-[#555] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {status.connected ? `Impressora ativa: ${status.printer ?? status.port}` : 'Nenhuma impressora selecionada ainda'}
            </p>
          </div>
        </div>
      </div>

      {status.connected && (
        <button type="button" onClick={handleTestar} disabled={testando}
          className="w-full py-2.5 rounded-xl text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 transition-all hover:brightness-110"
          style={{ background: ACCENT, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
          {testando
            ? <><Loader2 size={14} className="animate-spin" /> Imprimindo teste...</>
            : <><Send size={14} /> Imprimir teste — confirmar antes de abrir o caixa</>}
        </button>
      )}
      {testeResultado === 'ok' && (
        <p className="text-green-400 text-xs flex items-center gap-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <CheckCircle2 size={13} /> Saiu o cupom de teste? Se sim, pode abrir o caixa tranquilo.
        </p>
      )}
      {testeResultado === 'erro' && (
        <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Não foi possível imprimir. Confira a impressora (ligada, com papel, ainda pareada) e tente de novo.
        </p>
      )}

      <a href={PAINEL_URL} target="_blank" rel="noopener noreferrer"
        className="w-full py-2 rounded-xl text-xs font-medium flex items-center justify-center gap-2 border border-[#222] text-[#888] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-colors"
        style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <ExternalLink size={13} /> {status.connected ? 'Trocar impressora' : 'Escolher impressora'}
      </a>
    </div>
  )
}
