'use client'

import { useState } from 'react'
import { Clock, CheckCircle2, Zap, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ColaboradorRow {
  id:     string
  nome:   string | null
  email:  string | null
  codigo: string | null
  funcao: string | null
  evento: string
  aba:    'pendentes' | 'aceitos' | 'ativos'
}

const ABAS = [
  { value: 'pendentes' as const, label: 'Pendentes', icon: Clock,        desc: 'Convites ainda não respondidos' },
  { value: 'aceitos'   as const, label: 'Aceitos',    icon: CheckCircle2, desc: 'Já aceitaram, escalados pra eventos futuros' },
  { value: 'ativos'    as const, label: 'Ativos',     icon: Zap,          desc: 'Trabalhando hoje, no dia do evento' },
]

export function ColaboradoresClient({ linhas }: { linhas: ColaboradorRow[] }) {
  const [aba, setAba] = useState<'pendentes' | 'aceitos' | 'ativos'>('pendentes')

  const contagem = {
    pendentes: linhas.filter(l => l.aba === 'pendentes').length,
    aceitos:   linhas.filter(l => l.aba === 'aceitos').length,
    ativos:    linhas.filter(l => l.aba === 'ativos').length,
  }

  const filtradas = linhas.filter(l => l.aba === aba)
  const abaAtual  = ABAS.find(a => a.value === aba)!

  return (
    <div className="flex flex-col gap-5">

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a] overflow-x-auto">
        {ABAS.map(({ value, label, icon: Icon }) => (
          <button key={value} type="button" onClick={() => setAba(value)}
            className={cn(
              'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
              aba === value ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'text-[#666] hover:text-[#999]'
            )}
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <Icon size={13} />
            {label}
            {contagem[value] > 0 && (
              <span className="flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold"
                style={{
                  background: aba === value ? '#E8B84B' : '#1c1c1c',
                  color:      aba === value ? '#070707' : '#888',
                }}>
                {contagem[value]}
              </span>
            )}
          </button>
        ))}
      </div>

      <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{abaAtual.desc}</p>

      {/* Tabela */}
      {filtradas.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 py-16 rounded-2xl border border-dashed border-[#1c1c1c]">
          <Users size={20} className="text-[#333]" />
          <p className="text-[#444] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nenhum colaborador nessa aba.
          </p>
        </div>
      ) : (
        <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden overflow-x-auto">
          <table className="w-full text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <thead>
              <tr className="border-b border-[#141414] text-[#555] text-[11px] uppercase tracking-wider">
                <th className="text-left font-medium px-4 py-3">Nome</th>
                <th className="text-left font-medium px-4 py-3">E-mail</th>
                <th className="text-left font-medium px-4 py-3">Código</th>
                <th className="text-left font-medium px-4 py-3">Função</th>
                <th className="text-left font-medium px-4 py-3">Evento</th>
              </tr>
            </thead>
            <tbody>
              {filtradas.map(l => (
                <tr key={l.id} className="border-b border-[#111] last:border-0 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-white">{l.nome ?? '—'}</td>
                  <td className="px-4 py-3 text-[#888]">{l.email ?? '—'}</td>
                  <td className="px-4 py-3 text-[#E8B84B]/70 font-mono text-xs">{l.codigo ?? '—'}</td>
                  <td className="px-4 py-3 text-[#888]">{l.funcao ?? '—'}</td>
                  <td className="px-4 py-3 text-[#888]">{l.evento}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
