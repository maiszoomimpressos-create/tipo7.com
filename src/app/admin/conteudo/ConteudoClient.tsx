'use client'

import { useState } from 'react'
import { Save, Loader2, Check, FileText, Shield } from 'lucide-react'

const ACCENT = '#E8B84B'

type Tab = 'termos' | 'privacidade' | 'lgpd'

const TABS: { key: Tab; label: string; href: string }[] = [
  { key: 'termos',      label: 'Termos de Uso',          href: '/termos'             },
  { key: 'privacidade', label: 'Política de Privacidade', href: '/privacidade'        },
  { key: 'lgpd',        label: 'Proteção de Dados',       href: '/protecao-de-dados'  },
]

const PLACEHOLDER: Record<Tab, string> = {
  termos:      'Cole aqui o texto dos Termos de Uso...',
  privacidade: 'Cole aqui o texto da Política de Privacidade...',
  lgpd:        'Cole aqui o texto de Proteção de Dados (LGPD)...',
}

interface Props {
  termos:      string
  privacidade: string
  lgpd:        string
}

export function ConteudoClient({ termos: initialTermos, privacidade: initialPrivacidade, lgpd: initialLgpd }: Props) {
  const [tab,      setTab]      = useState<Tab>('termos')
  const [termos,   setTermos]   = useState(initialTermos)
  const [priv,     setPriv]     = useState(initialPrivacidade)
  const [lgpd,     setLgpd]     = useState(initialLgpd)
  const [salvando, setSalvando] = useState(false)
  const [sucesso,  setSucesso]  = useState(false)
  const [erro,     setErro]     = useState<string | null>(null)

  const contentMap: Record<Tab, string>                          = { termos, privacidade: priv, lgpd }
  const setContentMap: Record<Tab, (v: string) => void>          = { termos: setTermos, privacidade: setPriv, lgpd: setLgpd }
  const content    = contentMap[tab]
  const setContent = setContentMap[tab]

  async function handleSalvar() {
    setSalvando(true); setErro(null); setSucesso(false)
    try {
      const res = await fetch('/api/admin/conteudo', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ key: tab, content }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Erro ao salvar')
      setSucesso(true)
      setTimeout(() => setSucesso(false), 3000)
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao salvar')
    } finally {
      setSalvando(false)
    }
  }

  const currentTab = TABS.find(t => t.key === tab)!

  return (
    <div className="flex flex-col gap-6">

      {/* Aviso */}
      <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
           style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', fontFamily: 'var(--font-dm-sans)' }}>
        <Shield size={13} className="text-[#E8B84B] shrink-0 mt-0.5" />
        <span className="text-[#555]">
          Disponível em{' '}
          {TABS.map((t, i) => (
            <span key={t.key}>
              <a href={t.href} target="_blank" className="text-[#888] hover:text-white underline">{t.href}</a>
              {i < TABS.length - 1 ? ', ' : '. '}
            </span>
          ))}
          Use <strong className="text-[#777]">Markdown</strong>:{' '}
          <code className="text-[#666] text-[11px]">## Título</code>,{' '}
          <code className="text-[#666] text-[11px]">**negrito**</code>,{' '}
          <code className="text-[#666] text-[11px]">* item</code>,{' '}
          <code className="text-[#666] text-[11px]">---</code> para divisor.
        </span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 flex-wrap">
        {TABS.map(t => (
          <button
            key={t.key}
            type="button"
            onClick={() => { setTab(t.key); setErro(null); setSucesso(false) }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm transition-all"
            style={{
              background: tab === t.key ? `${ACCENT}12` : 'transparent',
              color:      tab === t.key ? ACCENT : '#555',
              fontFamily: 'var(--font-dm-sans)',
              fontWeight: tab === t.key ? 600 : 400,
              border:     `1px solid ${tab === t.key ? ACCENT + '30' : 'transparent'}`,
            }}
          >
            <FileText size={13} />
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      <div className="flex flex-col gap-3">
        <textarea
          key={tab}
          value={content}
          onChange={e => setContent(e.target.value)}
          rows={24}
          placeholder={PLACEHOLDER[tab]}
          className="w-full bg-[#0d0d0d] border border-[#1e1e1e] rounded-2xl px-5 py-4 text-white text-sm outline-none resize-y focus:border-[#E8B84B]/30 placeholder:text-[#2a2a2a] leading-relaxed"
          style={{ fontFamily: 'var(--font-dm-sans)', minHeight: 400 }}
        />

        {erro && (
          <p className="text-red-400 text-xs px-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {erro}
          </p>
        )}
        {sucesso && (
          <div className="flex items-center gap-2 text-green-400 text-xs px-3 py-2 rounded-lg bg-green-400/5">
            <Check size={12} /> {currentTab.label} salvo com sucesso!
          </div>
        )}

        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSalvar}
            disabled={salvando}
            className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
            style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
          >
            {salvando
              ? <><Loader2 size={14} className="animate-spin" /> Salvando...</>
              : <><Save size={14} /> Salvar</>
            }
          </button>
        </div>
      </div>
    </div>
  )
}
