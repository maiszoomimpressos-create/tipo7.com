'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, User, Loader2, X, ArrowRight, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  promotorId:      string | null
  tipoPessoaAtual: 'pf' | 'pj' | null
  nomeUsuario:     string
  onFechar:        () => void
}

const baseInput = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

export function TipoPessoaModal({ promotorId, tipoPessoaAtual, nomeUsuario, onFechar }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const router    = useRouter()

  const [etapa,       setEtapa]       = useState<1 | 2>(1)
  const [tipoPessoa,  setTipoPessoa]  = useState<'pf' | 'pj' | ''>(tipoPessoaAtual ?? '')
  const [eventoId,    setEventoId]    = useState<string | null>(null)
  const [saving,      setSaving]      = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Etapa 2 — dados básicos do evento
  const [nomeEvento,  setNomeEvento]  = useState('')
  const [cnpj,        setCnpj]        = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [savingEvento, setSavingEvento] = useState(false)

  const formatCNPJ = (v: string) => {
    const d = v.replace(/\D/g,'').slice(0,14)
    if (d.length <= 2)  return d
    if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  // Etapa 1 → "Seguir": salva promotor + cria rascunho, permanece no modal
  const handleSeguir = async () => {
    if (!user || !tipoPessoa) return
    setSaving(true)
    setErro(null)
    try {
      // Salva perfil de promotor
      if (promotorId) {
        const { error } = await supabase
          .from('promotor_profiles')
          .update({ tipo_pessoa: tipoPessoa })
          .eq('id', promotorId)
        if (error) throw error
      } else {
        const { error } = await supabase
          .from('promotor_profiles')
          .insert({ user_id: user.id, tipo_pessoa: tipoPessoa })
        if (error) throw error
      }

      // Busca ou cria organização
      const { data: orgExistente } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', 'promotora')
        .maybeSingle()

      let orgId: string
      if (orgExistente) {
        orgId = orgExistente.id
      } else {
        const { data: novaOrg, error: errOrg } = await supabase
          .from('organizations')
          .insert({ name: nomeUsuario, type: 'promotora', owner_id: user.id })
          .select('id')
          .single()
        if (errOrg) throw errOrg
        orgId = novaOrg.id
      }

      // Cria rascunho do evento
      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({ organization_id: orgId, created_by: user.id, status: 'rascunho' })
        .select('id')
        .single()
      if (errEvento) throw errEvento

      setEventoId(evento.id)
      setEtapa(2)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // Etapa 2 → "Continuar": salva nome do evento (e CNPJ/razão para PJ) e redireciona
  const handleContinuar = async () => {
    if (!eventoId) return
    setSavingEvento(true)
    try {
      const updates: Record<string, string> = {}
      if (nomeEvento.trim()) updates.title = nomeEvento.trim()
      if (tipoPessoa === 'pj' && razaoSocial.trim()) {
        // Atualiza nome da organização com razão social
        await supabase
          .from('organizations')
          .update({ name: razaoSocial.trim() })
          .eq('owner_id', user!.id)
      }
      if (Object.keys(updates).length) {
        await supabase.from('events').update(updates).eq('id', eventoId)
      }
      router.push(`/criar-evento/${eventoId}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingEvento(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl overflow-hidden shadow-2xl shadow-black/60">

        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

        <div className="p-6">

          {/* Indicador de etapa */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {[1, 2].map(n => (
                <div key={n} className="flex items-center gap-2">
                  <div className={cn(
                    'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
                    etapa === n
                      ? 'bg-[#E8B84B] text-[#070707]'
                      : etapa > n
                        ? 'bg-green-500 text-white'
                        : 'bg-[#1c1c1c] text-[#444]'
                  )}>
                    {etapa > n ? <CheckCircle2 size={12} /> : n}
                  </div>
                  {n < 2 && <div className={cn('w-8 h-px', etapa > n ? 'bg-green-500' : 'bg-[#1c1c1c]')} />}
                </div>
              ))}
            </div>
            <button type="button" onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ── Etapa 1: PF ou PJ ── */}
          {etapa === 1 && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Como você atua?
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Define como os documentos e ingressos serão emitidos
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-5">
                {([
                  { value: 'pf' as const, icon: User,      label: 'Pessoa física',   desc: 'Organizo em meu nome pessoal' },
                  { value: 'pj' as const, icon: Building2, label: 'Pessoa jurídica', desc: 'Tenho empresa ou CNPJ'         },
                ]).map(({ value, icon: Icon, label, desc }) => (
                  <button key={value} type="button" onClick={() => setTipoPessoa(value)}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200',
                      tipoPessoa === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                        : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                    )}
                  >
                    <div className={cn(
                      'w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      tipoPessoa === value ? 'bg-[#E8B84B]/15' : 'bg-[#161616]'
                    )}>
                      <Icon size={16} className={tipoPessoa === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', tipoPessoa === value ? 'text-white' : 'text-[#777]')}
                         style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {erro && (
                <p className="text-red-400 text-xs text-center mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
              )}

              <button type="button" onClick={handleSeguir}
                disabled={!tipoPessoa || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
              >
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Seguir</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ── Etapa 2: dados do evento (caminho varia por PF/PJ) ── */}
          {etapa === 2 && (
            <>
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-3">
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {tipoPessoa === 'pj' ? 'Dados da empresa' : 'Sobre o evento'}
                  </p>
                  {/* Badge mostrando a escolha PF/PJ */}
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{
                      fontFamily: 'var(--font-dm-sans)',
                      background: tipoPessoa === 'pj' ? 'rgba(232,184,75,0.10)' : 'rgba(99,179,237,0.10)',
                      borderColor: tipoPessoa === 'pj' ? 'rgba(232,184,75,0.30)' : 'rgba(99,179,237,0.30)',
                      color: tipoPessoa === 'pj' ? '#E8B84B' : '#63B3ED',
                    }}
                  >
                    {tipoPessoa === 'pj' ? 'Pessoa Jurídica' : 'Pessoa Física'}
                  </span>
                </div>
                <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {tipoPessoa === 'pj'
                    ? 'Informe a razão social e CNPJ para emissão de documentos'
                    : 'Como seu evento se chama?'
                  }
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-5">
                {tipoPessoa === 'pj' && (
                  <>
                    <input type="text" placeholder="Razão social *" value={razaoSocial}
                      onChange={e => setRazaoSocial(e.target.value)}
                      className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    <input type="text" placeholder="CNPJ" value={cnpj}
                      onChange={e => setCnpj(formatCNPJ(e.target.value))}
                      className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  </>
                )}
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={baseInput} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              {/* Mini banner: rascunho já salvo */}
              <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Rascunho criado e salvo automaticamente
                </p>
              </div>

              {erro && (
                <p className="text-red-400 text-xs text-center mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>
              )}

              <button type="button" onClick={handleContinuar}
                disabled={savingEvento || !nomeEvento.trim() || (tipoPessoa === 'pj' && !razaoSocial.trim())}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 transition-all hover:brightness-110 flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
              >
                {savingEvento ? <Loader2 size={15} className="animate-spin" /> : <><span>Continuar</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
