'use client'

import { useState } from 'react'
import { Save, Loader2, Check, FileText, Shield, GraduationCap, Trash2, Plus, ChevronUp, ChevronDown } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { TUTORIAL_ICONES, TUTORIAL_ICONE_KEYS, TUTORIAL_PASSOS_PADRAO, type TutorialPasso } from '@/lib/tutorialIcons'

const ACCENT = '#E8B84B'

type Tab = 'termos' | 'privacidade' | 'lgpd' | 'tutorial_evento'

const TABS: { key: Tab; label: string; href: string | null }[] = [
  { key: 'termos',          label: 'Termos de Uso',           href: '/termos'            },
  { key: 'privacidade',     label: 'Política de Privacidade', href: '/privacidade'       },
  { key: 'lgpd',            label: 'Proteção de Dados',       href: '/protecao-de-dados' },
  { key: 'tutorial_evento', label: 'Tutorial de evento',      href: null                 },
]

const PLACEHOLDER: Record<'termos' | 'privacidade' | 'lgpd', string> = {
  termos:      'Cole aqui o texto dos Termos de Uso...',
  privacidade: 'Cole aqui o texto da Política de Privacidade...',
  lgpd:        'Cole aqui o texto de Proteção de Dados (LGPD)...',
}

// Achado real (22/08/2026, JSON malformado/vazio na primeira vez que a
// chave 'tutorial_evento' é acessada — a linha nem existe ainda em
// platform_content): sempre cai no padrão em vez de mostrar tela vazia.
function parseTutorial(raw: string): TutorialPasso[] {
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed) && parsed.length > 0) return parsed
  } catch { /* JSON vazio/inválido — cai no padrão abaixo */ }
  return TUTORIAL_PASSOS_PADRAO
}

interface Props {
  termos:      string
  privacidade: string
  lgpd:        string
  tutorial:    string
}

// Conteúdo do Tutorial de evento (usado em GerenciarSidebar.tsx e
// AdminSidebar.tsx, ver components/TutorialModal.tsx) é editável SÓ aqui —
// pedido explícito do usuário (22/08/2026). Reaproveita a mesma tabela/rota
// platform_content já usada pra Termos/Privacidade/LGPD (key=
// 'tutorial_evento'), só que o content guardado é JSON (array de passos)
// em vez de Markdown puro — por isso esse tab renderiza um editor
// estruturado (título + ícone + texto por passo) em vez do textarea.
export function ConteudoClient({ termos: initialTermos, privacidade: initialPrivacidade, lgpd: initialLgpd, tutorial: initialTutorial }: Props) {
  const [tab,      setTab]      = useState<Tab>('termos')
  const [termos,   setTermos]   = useState(initialTermos)
  const [priv,     setPriv]     = useState(initialPrivacidade)
  const [lgpd,     setLgpd]     = useState(initialLgpd)
  const [passos,   setPassos]   = useState<TutorialPasso[]>(() => parseTutorial(initialTutorial))
  const [salvando, setSalvando] = useState(false)
  const [sucesso,  setSucesso]  = useState(false)
  const [erro,     setErro]     = useState<string | null>(null)

  const contentMap: Record<'termos' | 'privacidade' | 'lgpd', string>                  = { termos, privacidade: priv, lgpd }
  const setContentMap: Record<'termos' | 'privacidade' | 'lgpd', (v: string) => void>  = { termos: setTermos, privacidade: setPriv, lgpd: setLgpd }

  async function handleSalvar() {
    setSalvando(true); setErro(null); setSucesso(false)
    try {
      const content = tab === 'tutorial_evento' ? JSON.stringify(passos) : contentMap[tab]
      const res = await apiFetchAuth('/api/admin/conteudo', {
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

  function atualizarPasso(i: number, patch: Partial<TutorialPasso>) {
    setPassos(prev => prev.map((p, idx) => (idx === i ? { ...p, ...patch } : p)))
  }
  function removerPasso(i: number) {
    setPassos(prev => prev.filter((_, idx) => idx !== i))
  }
  function moverPasso(i: number, direcao: -1 | 1) {
    setPassos(prev => {
      const alvo = i + direcao
      if (alvo < 0 || alvo >= prev.length) return prev
      const copia = [...prev]
      ;[copia[i], copia[alvo]] = [copia[alvo], copia[i]]
      return copia
    })
  }
  function adicionarPasso() {
    setPassos(prev => [...prev, { icone: 'Sparkles', titulo: 'Novo passo', texto: '' }])
  }

  const currentTab = TABS.find(t => t.key === tab)!

  return (
    <div className="flex flex-col gap-6">

      {/* Aviso */}
      {tab === 'tutorial_evento' ? (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
             style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', fontFamily: 'var(--font-dm-sans)' }}>
          <GraduationCap size={13} className="text-[#E8B84B] shrink-0 mt-0.5" />
          <span className="text-[#555]">
            Aparece no botão &quot;Tutorial&quot; do painel de gestão do evento (promotor) e no painel admin (equipe Tipo7). A ordem daqui é a ordem exibida — use as setas pra reorganizar.
          </span>
        </div>
      ) : (
        <div className="flex items-start gap-3 px-4 py-3 rounded-xl text-xs"
             style={{ background: '#0d0d0d', border: '1px solid #1a1a1a', fontFamily: 'var(--font-dm-sans)' }}>
          <Shield size={13} className="text-[#E8B84B] shrink-0 mt-0.5" />
          <span className="text-[#555]">
            Disponível em{' '}
            {TABS.filter(t => t.href).map((t, i, arr) => (
              <span key={t.key}>
                <a href={t.href!} target="_blank" className="text-[#888] hover:text-white underline">{t.href}</a>
                {i < arr.length - 1 ? ', ' : '. '}
              </span>
            ))}
            Use <strong className="text-[#777]">Markdown</strong>:{' '}
            <code className="text-[#666] text-[11px]">## Título</code>,{' '}
            <code className="text-[#666] text-[11px]">**negrito**</code>,{' '}
            <code className="text-[#666] text-[11px]">* item</code>,{' '}
            <code className="text-[#666] text-[11px]">---</code> para divisor.
          </span>
        </div>
      )}

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
            {t.key === 'tutorial_evento' ? <GraduationCap size={13} /> : <FileText size={13} />}
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor */}
      {tab === 'tutorial_evento' ? (
        <div className="flex flex-col gap-3">
          {passos.map((p, i) => {
            const Icon = TUTORIAL_ICONES[p.icone] ?? TUTORIAL_ICONES.Layers
            return (
              <div key={i} className="flex flex-col gap-2 p-4 rounded-2xl" style={{ background: '#0d0d0d', border: '1px solid #1e1e1e' }}>
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${ACCENT}15` }}>
                    <Icon size={13} style={{ color: ACCENT }} />
                  </div>
                  <select
                    value={p.icone}
                    onChange={e => atualizarPasso(i, { icone: e.target.value })}
                    className="bg-[#111] border border-[#222] rounded-lg px-2 py-1.5 text-white text-xs outline-none"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {TUTORIAL_ICONE_KEYS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                  <input
                    type="text"
                    value={p.titulo}
                    onChange={e => atualizarPasso(i, { titulo: e.target.value })}
                    placeholder="Título do passo"
                    className="flex-1 bg-[#111] border border-[#222] rounded-lg px-3 py-1.5 text-white text-sm font-medium outline-none focus:border-[#E8B84B]/30"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  <button type="button" onClick={() => moverPasso(i, -1)} disabled={i === 0}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:text-white disabled:opacity-20 transition-colors">
                    <ChevronUp size={14} />
                  </button>
                  <button type="button" onClick={() => moverPasso(i, 1)} disabled={i === passos.length - 1}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:text-white disabled:opacity-20 transition-colors">
                    <ChevronDown size={14} />
                  </button>
                  <button type="button" onClick={() => removerPasso(i)}
                    className="w-7 h-7 flex items-center justify-center rounded-lg text-[#555] hover:text-red-400 transition-colors">
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={p.texto}
                  onChange={e => atualizarPasso(i, { texto: e.target.value })}
                  rows={2}
                  placeholder="Explicação do que fazer nesse passo..."
                  className="w-full bg-[#111] border border-[#222] rounded-lg px-3 py-2 text-white text-xs outline-none resize-y focus:border-[#E8B84B]/30 placeholder:text-[#333]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>
            )
          })}

          <button
            type="button"
            onClick={adicionarPasso}
            className="flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium border transition-colors hover:border-[#E8B84B]/40 hover:text-white"
            style={{ borderColor: '#1e1e1e', color: '#555', fontFamily: 'var(--font-dm-sans)' }}
          >
            <Plus size={14} /> Adicionar passo
          </button>

          {erro && <p className="text-red-400 text-xs px-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}
          {sucesso && (
            <div className="flex items-center gap-2 text-green-400 text-xs px-3 py-2 rounded-lg bg-green-400/5">
              <Check size={12} /> Tutorial de evento salvo com sucesso!
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
              {salvando ? <><Loader2 size={14} className="animate-spin" /> Salvando...</> : <><Save size={14} /> Salvar</>}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          <textarea
            key={tab}
            value={contentMap[tab]}
            onChange={e => setContentMap[tab](e.target.value)}
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
      )}
    </div>
  )
}
