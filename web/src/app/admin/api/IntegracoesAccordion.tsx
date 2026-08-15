'use client'

// Tela de integrações: credenciais reais (usadas de verdade por
// lib/autosave.ts e api/webhooks/autosave) + documentação editável dos
// campos que cada rota manda/recebe (só documentação — mudar aqui não
// muda o que o código realmente envia/pede, isso ainda exige deploy).
import { useState } from 'react'
import {
  ArrowRight, ArrowLeft, Radio, Users, Car, MessageCircle, ChevronDown, Eye, EyeOff,
  Pencil, Check, X, Loader2, KeyRound, Printer,
} from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

type Direcao = 'entra' | 'sai' | 'push'

interface Rota {
  id:             string
  integracao_id:  string
  rota:           string
  direcao:        Direcao
  gatilho:        string | null
  campos_envia:   string[]
  campos_recebe:  string[]
  observacao:     string | null
  order_index:    number
}

interface Integracao {
  id:             string
  area_slug:      'usuarios' | 'estacionamento' | 'whatsapp' | 'tipprint'
  nome:           string
  base_url:       string | null
  api_key:        string | null
  webhook_secret: string | null
  rotas:          Rota[]
}

const AREA_ICON = { usuarios: Users, estacionamento: Car, whatsapp: MessageCircle, tipprint: Printer } as const
const AREA_COR  = { usuarios: '#E8B84B', estacionamento: '#38bdf8', whatsapp: '#25D366', tipprint: '#f97316' } as const
const AREA_SUB  = {
  usuarios:      'cadastro e edição de perfil',
  estacionamento: 'registro de entrada de veículos',
  whatsapp:      'envio de ingresso/estacionamento via Boot Whats',
  // Provisionamento automático do PrintServer TipPrint em PC Windows —
  // ver memória do projeto (project_tipprint_provisionamento_pc). Ainda
  // sem base_url pública do lado deles: enquanto "Não configurado", o
  // botão "PC" da Bilheteria continua caindo pro Web Serial de sempre.
  tipprint:      'provisionamento automático do PrintServer (PC Windows)',
} as const
const AREA_NOME = { usuarios: 'Usuários', estacionamento: 'Estacionamento', whatsapp: 'WhatsApp', tipprint: 'TipPrint' } as const

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 font-mono placeholder:text-[#383838] placeholder:font-sans'
const lbl = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

function DirecaoBadge({ direcao }: { direcao: Direcao }) {
  const cfg = {
    entra: { label: 'Autosave → Tipo7', icon: ArrowLeft,  color: '#38bdf8' },
    sai:   { label: 'Tipo7 → Autosave', icon: ArrowRight, color: '#E8B84B' },
    push:  { label: 'Autosave → Tipo7 (push)', icon: Radio, color: '#a78bfa' },
  }[direcao]
  const Icon = cfg.icon
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium shrink-0"
      style={{ background: `${cfg.color}12`, color: cfg.color, fontFamily: 'var(--font-dm-sans)' }}
    >
      <Icon size={11} />
      {cfg.label}
    </span>
  )
}

function CampoChip({ campo }: { campo: string }) {
  return (
    <span className="px-2 py-1 rounded-md text-[11px] font-mono" style={{ background: '#111', border: '1px solid #1e1e1e', color: '#999' }}>
      {campo}
    </span>
  )
}

function CampoSecreto({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [visivel, setVisivel] = useState(false)
  return (
    <div className="flex flex-col gap-1.5">
      <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</label>
      <div className="relative">
        <input
          type={visivel ? 'text' : 'password'}
          value={value}
          onChange={e => onChange(e.target.value)}
          placeholder="Cole aqui"
          className={inp.replace('px-4', 'pl-4 pr-10')}
        />
        <button type="button" onClick={() => setVisivel(v => !v)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors">
          {visivel ? <EyeOff size={14} /> : <Eye size={14} />}
        </button>
      </div>
    </div>
  )
}

function CredenciaisForm({ integracao }: { integracao: Integracao }) {
  const [baseUrl,       setBaseUrl]       = useState(integracao.base_url ?? '')
  const [apiKey,        setApiKey]        = useState(integracao.api_key ?? '')
  const [webhookSecret, setWebhookSecret] = useState(integracao.webhook_secret ?? '')
  const [saving, setSaving] = useState(false)
  const [saved,  setSaved]  = useState(false)
  const [erro,   setErro]   = useState(false)

  const temWebhook   = integracao.area_slug === 'usuarios'
  const configurado  = !!baseUrl && !!apiKey

  const salvar = async () => {
    setSaving(true); setErro(false)
    try {
      const res = await apiFetchAuth(`/api/admin/integracoes/${integracao.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ base_url: baseUrl, api_key: apiKey, ...(temWebhook ? { webhook_secret: webhookSecret } : {}) }),
      })
      if (!res.ok) { setErro(true); return }
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setErro(true)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl p-5 mb-3" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <KeyRound size={13} className="text-[#555]" />
          <p className="text-white text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Credenciais</p>
        </div>
        <span
          className="text-[10px] px-2 py-0.5 rounded-full font-medium"
          style={{
            background: configurado ? 'rgba(34,197,94,0.1)' : 'rgba(248,113,113,0.1)',
            color:      configurado ? '#4ade80' : '#f87171',
            fontFamily: 'var(--font-dm-sans)',
          }}
        >
          {configurado ? 'Configurado' : 'Não configurado'}
        </span>
      </div>

      <div className="flex flex-col gap-3">
        <div className="flex flex-col gap-1.5">
          <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>Base URL</label>
          <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} placeholder="https://..." className={inp} />
        </div>
        <CampoSecreto label="API Key" value={apiKey} onChange={setApiKey} />
        {temWebhook && <CampoSecreto label="Webhook Secret" value={webhookSecret} onChange={setWebhookSecret} />}
      </div>

      {erro && <p className="text-red-400 text-xs mt-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>Erro ao salvar. Tente de novo.</p>}

      <button type="button" onClick={salvar} disabled={saving}
        className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60 hover:brightness-110 transition-all"
        style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
        {saving ? <Loader2 size={13} className="animate-spin" /> : saved ? <Check size={13} /> : null}
        {saved ? 'Salvo' : 'Salvar chave'}
      </button>
    </div>
  )
}

function RotaCard({ item }: { item: Rota }) {
  const [aberto,    setAberto]    = useState(false)
  const [editando,  setEditando]  = useState(false)
  const [saving,    setSaving]    = useState(false)

  const [gatilho,     setGatilho]     = useState(item.gatilho ?? '')
  const [enviaTexto,  setEnviaTexto]  = useState((item.campos_envia ?? []).join(', '))
  const [recebeTexto, setRecebeTexto] = useState((item.campos_recebe ?? []).join(', '))
  const [observacao,  setObservacao]  = useState(item.observacao ?? '')

  const [envia,  setEnvia]  = useState(item.campos_envia ?? [])
  const [recebe, setRecebe] = useState(item.campos_recebe ?? [])

  const salvar = async () => {
    setSaving(true)
    const novaEnvia  = enviaTexto.split(',').map(s => s.trim()).filter(Boolean)
    const novaRecebe = recebeTexto.split(',').map(s => s.trim()).filter(Boolean)
    try {
      const res = await apiFetchAuth(`/api/admin/integracoes/rotas/${item.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gatilho, campos_envia: novaEnvia, campos_recebe: novaRecebe, observacao }),
      })
      if (res.ok) {
        setEnvia(novaEnvia)
        setRecebe(novaRecebe)
        setEditando(false)
      }
    } finally {
      setSaving(false)
    }
  }

  const cancelar = () => {
    setGatilho(item.gatilho ?? '')
    setEnviaTexto(envia.join(', '))
    setRecebeTexto(recebe.join(', '))
    setObservacao(item.observacao ?? '')
    setEditando(false)
  }

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
      <button type="button" onClick={() => setAberto(v => !v)}
        className="w-full px-5 py-3.5 flex items-center justify-between gap-3 flex-wrap text-left hover:bg-[#111] transition-colors">
        <div className="flex items-center gap-3 min-w-0">
          <ChevronDown size={14} className="text-[#444] shrink-0 transition-transform duration-200"
            style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)' }} />
          <p className="text-white text-sm font-mono truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{item.rota}</p>
        </div>
        <DirecaoBadge direcao={item.direcao} />
      </button>

      {aberto && (
        <div className="px-5 pb-5 pt-1 flex flex-col gap-4 border-t border-[#141414]">
          <div className="flex items-start justify-between gap-3 pt-4">
            <p className="text-[#666] text-xs flex-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{gatilho}</p>
            {!editando && (
              <button type="button" onClick={() => setEditando(true)}
                className="text-[#444] hover:text-[#E8B84B] transition-colors shrink-0">
                <Pencil size={13} />
              </button>
            )}
          </div>

          {!editando ? (
            <>
              {envia.length > 0 && (
                <div>
                  <p className="text-[#444] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Envia</p>
                  <div className="flex flex-wrap gap-1.5">{envia.map(c => <CampoChip key={c} campo={c} />)}</div>
                </div>
              )}
              {recebe.length > 0 && (
                <div>
                  <p className="text-[#444] text-[10px] uppercase tracking-wider mb-1.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Recebe</p>
                  <div className="flex flex-wrap gap-1.5">{recebe.map(c => <CampoChip key={c} campo={c} />)}</div>
                </div>
              )}
              {observacao && (
                <p className="text-[#555] text-[11px] leading-relaxed border-t border-[#141414] pt-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {observacao}
                </p>
              )}
            </>
          ) : (
            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>Gatilho</label>
                <input value={gatilho} onChange={e => setGatilho(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40" style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>Envia (separados por vírgula)</label>
                <input value={enviaTexto} onChange={e => setEnviaTexto(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>Recebe (separados por vírgula)</label>
                <input value={recebeTexto} onChange={e => setRecebeTexto(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 font-mono" />
              </div>
              <div className="flex flex-col gap-1.5">
                <label className={lbl} style={{ fontFamily: 'var(--font-dm-sans)' }}>Observação</label>
                <textarea value={observacao} onChange={e => setObservacao(e.target.value)} rows={2}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-white text-xs outline-none focus:border-[#E8B84B]/40 resize-none" style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>
              <div className="flex gap-2">
                <button type="button" onClick={salvar} disabled={saving}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-60 hover:brightness-110 transition-all"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                  {saving ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Salvar
                </button>
                <button type="button" onClick={cancelar}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs text-[#555] hover:text-white border border-[#1e1e1e] hover:border-[#333] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  <X size={12} />
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Secao({ integracao }: { integracao: Integracao }) {
  const [aberto, setAberto] = useState(false)
  const Icon = AREA_ICON[integracao.area_slug]
  const nome = AREA_NOME[integracao.area_slug]

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
      <button type="button" onClick={() => setAberto(v => !v)}
        className="w-full px-5 py-4 flex items-center gap-3 text-left hover:bg-[#111] transition-colors">
        <ChevronDown size={15} className="text-[#444] shrink-0 transition-transform duration-200"
          style={{ transform: aberto ? 'rotate(180deg)' : 'rotate(0deg)' }} />
        <Icon size={16} className="shrink-0" style={{ color: AREA_COR[integracao.area_slug] }} />
        <div className="min-w-0">
          <h2 className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-outfit)' }}>{nome}</h2>
          <p className="text-[#444] text-[11px] truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>{AREA_SUB[integracao.area_slug]}</p>
        </div>
      </button>

      {aberto && (
        <div className="px-5 pb-5 pt-4 border-t border-[#141414] flex flex-col gap-3">
          <CredenciaisForm integracao={integracao} />
          <div className="flex flex-col gap-2">
            {integracao.rotas.map(item => <RotaCard key={item.id} item={item} />)}
          </div>
        </div>
      )}
    </div>
  )
}

export function IntegracoesAccordion({ integracoes }: { integracoes: Integracao[] }) {
  return (
    <div className="flex flex-col gap-8">
      {integracoes.map(i => <Secao key={i.id} integracao={i} />)}
    </div>
  )
}
