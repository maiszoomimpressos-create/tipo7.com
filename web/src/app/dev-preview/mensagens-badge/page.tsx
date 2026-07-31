'use client'

// Caixa de teste isolada da animação da bolinha de "mensagem pendente" no
// Header — não depende de convite real no banco, só um toggle local. Usar
// pra conferir visualmente antes de mexer no Header de verdade. Rota de
// desenvolvimento, não linkada em nenhum menu.
import { useState } from 'react'
import { Menu, MessageSquare, Briefcase, Building2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

function Dot() {
  return (
    <span className="absolute -top-0.5 -right-0.5 flex">
      <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75" />
      <span className="relative w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#070707]" />
    </span>
  )
}

export default function MensagensBadgePreview() {
  const [temPendente, setTemPendente] = useState(true)
  const [mensagensOpen, setMensagensOpen] = useState(false)

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center gap-10 p-10">

      <button
        type="button"
        onClick={() => setTemPendente(v => !v)}
        className="px-4 py-2 rounded-xl text-sm font-semibold text-[#070707]"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
      >
        {temPendente ? 'Desligar pendência' : 'Ligar pendência'}
      </button>

      {/* ── Avatar (desktop) ── */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Avatar — menu do usuário</p>
        <div className="flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full border border-[#222] bg-[#111]">
          <div className="relative shrink-0">
            <div
              className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#070707]"
              style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}
            >
              L
            </div>
            {temPendente && <Dot />}
          </div>
          <span className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>Lasejo</span>
          <ChevronDown size={14} className="text-[#555]" />
        </div>
      </div>

      {/* ── Hambúrguer (mobile) ── */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Hambúrguer — mobile</p>
        <div className="relative flex items-center justify-center w-9 h-9 rounded-lg text-white/70 bg-white/5">
          <Menu size={20} />
          {temPendente && <span className="absolute top-1 right-1 flex">
            <span className="absolute w-2.5 h-2.5 bg-red-500 rounded-full animate-ping opacity-75" />
            <span className="relative w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#070707]" />
          </span>}
        </div>
      </div>

      {/* ── Submenu "Mensagens" (dropdown desktop) ── */}
      <div className="flex flex-col items-center gap-2">
        <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Submenu "Mensagens"</p>
        <div className="w-64 rounded-xl border border-[#1c1c1c] bg-[#0d0d0d] overflow-hidden">
          <button
            type="button"
            onClick={() => setMensagensOpen(v => !v)}
            className="w-full flex items-center justify-between px-4 py-2.5 text-sm text-[#bbb] hover:text-white hover:bg-white/5 transition-colors"
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          >
            <span className="flex items-center gap-3">
              <MessageSquare size={14} className="text-[#555]" />
              Mensagens
            </span>
            <span className="flex items-center gap-1.5">
              {temPendente && (
                <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#070707]" style={{ background: '#4ade80' }}>
                  2
                </span>
              )}
              <ChevronDown size={12} className={cn('text-[#444] transition-transform', mensagensOpen && 'rotate-180')} />
            </span>
          </button>

          {mensagensOpen && (
            <div className="flex flex-col bg-black/20">
              <div className="flex items-center justify-between pl-9 pr-4 py-2 text-sm text-[#999]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <span className="flex items-center gap-2.5">
                  <Briefcase size={13} className="text-[#555]" />
                  Trabalhos
                </span>
                {temPendente && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#070707]" style={{ background: '#4ade80' }}>1</span>
                )}
              </div>
              <div className="flex items-center justify-between pl-9 pr-4 py-2 text-sm text-[#999]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <span className="flex items-center gap-2.5">
                  <Building2 size={13} className="text-[#555]" />
                  Organizações
                </span>
                {temPendente && (
                  <span className="flex items-center justify-center w-4 h-4 rounded-full text-[10px] font-bold text-[#070707]" style={{ background: '#4ade80' }}>1</span>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

    </div>
  )
}
