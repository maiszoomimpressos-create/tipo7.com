'use client'

// Modal de criação de evento — define tipo de pessoa e dados da empresa
// PF: 2 etapas | PJ: 3 etapas (tipo empresa → dados → contato/evento)
// Dados do perfil do usuário são pré-preenchidos automaticamente
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import { Building2, User, Loader2, X, ArrowRight, CheckCircle2, MapPin, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

export interface ProfileData {
  phone:         string
  zip_code:      string
  street:        string
  street_number: string
  neighborhood:  string
  city:          string
  state:         string
  complement:    string
}

interface Props {
  promotorId:      string | null
  tipoPessoaAtual: 'pf' | 'pj' | null
  nomeUsuario:     string
  profile:         ProfileData
  onFechar:        () => void
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'

export function TipoPessoaModal({ promotorId, tipoPessoaAtual, nomeUsuario, profile, onFechar }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const router    = useRouter()

  // Navegação
  const [etapa,      setEtapa]      = useState<1 | 2 | 3>(1)
  const [tipoPessoa, setTipoPessoa] = useState<'pf' | 'pj' | ''>(tipoPessoaAtual ?? '')
  const [orgTipo,    setOrgTipo]    = useState<'promotora' | 'estabelecimento' | ''>('')
  const [orgId,      setOrgId]      = useState<string | null>(null)
  const [eventoId,   setEventoId]   = useState<string | null>(null)

  // Loading / erro
  const [saving,      setSaving]      = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Dados da empresa (etapa 2 PJ)
  const [razaoSocial,  setRazaoSocial]  = useState('')
  const [cnpj,         setCnpj]         = useState('')
  const [nomeFantasia, setNomeFantasia] = useState('')

  // Contato / endereço (etapa 3 PJ — pré-preenchido do perfil)
  const [phone,        setPhone]        = useState(profile.phone)
  const [zipCode,      setZipCode]      = useState(profile.zip_code)
  const [street,       setStreet]       = useState(profile.street)
  const [streetNumber, setStreetNumber] = useState(profile.street_number)
  const [neighborhood, setNeighborhood] = useState(profile.neighborhood)
  const [city,         setCity]         = useState(profile.city)
  const [uf,           setUf]           = useState(profile.state)
  const [complement,   setComplement]   = useState(profile.complement)
  const [capacity,     setCapacity]     = useState('')

  // Nome do evento (última etapa)
  const [nomeEvento, setNomeEvento] = useState('')

  const totalEtapas = tipoPessoa === 'pj' ? 3 : 2

  const formatCNPJ = (v: string) => {
    const d = v.replace(/\D/g, '').slice(0, 14)
    if (d.length <= 2)  return d
    if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
    if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
    if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
    return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
  }

  // ── Etapa 1 → salva tipo_pessoa, cria org + rascunho ──────────────────
  const handleSeguir = async () => {
    if (!user || !tipoPessoa) return
    setSaving(true)
    setErro(null)
    try {
      if (promotorId) {
        await supabase.from('promotor_profiles').update({ tipo_pessoa: tipoPessoa }).eq('id', promotorId)
      } else {
        await supabase.from('promotor_profiles').insert({ user_id: user.id, tipo_pessoa: tipoPessoa })
      }

      // Busca ou cria organização (sem filtro de tipo — pode ser promotora ou estabelecimento)
      const { data: orgExistente } = await supabase
        .from('organizations')
        .select('id')
        .eq('owner_id', user.id)
        .maybeSingle()

      let newOrgId: string
      if (orgExistente) {
        newOrgId = orgExistente.id
      } else {
        const { data: novaOrg, error: errOrg } = await supabase
          .from('organizations')
          .insert({ name: nomeUsuario, type: 'promotora', owner_id: user.id })
          .select('id')
          .single()
        if (errOrg) throw errOrg
        newOrgId = novaOrg.id
      }

      // Cria rascunho do evento
      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({ organization_id: newOrgId, created_by: user.id, status: 'rascunho' })
        .select('id')
        .single()
      if (errEvento) throw errEvento

      setOrgId(newOrgId)
      setEventoId(evento.id)
      setEtapa(2)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Etapa 2 (PJ) → salva dados da empresa + gera código ───────────────
  const handleEtapa2PJ = async () => {
    if (!orgId || !orgTipo || !razaoSocial.trim()) return
    setSaving(true)
    setErro(null)
    try {
      const res    = await fetch(`/api/codigo?tipo=${orgTipo}`)
      const { codigo } = await res.json() as { codigo: string }

      const { error } = await supabase.from('organizations').update({
        name:          razaoSocial.trim(),
        type:          orgTipo,
        cnpj:          cnpj || null,
        nome_fantasia: nomeFantasia.trim() || null,
        codigo,
      }).eq('id', orgId)

      if (error) throw error
      setEtapa(3)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Etapa final → salva contato/endereço + nome do evento → redireciona ─
  const handleContinuar = async () => {
    if (!eventoId || !nomeEvento.trim()) return
    setSavingFinal(true)
    try {
      await supabase.from('events').update({ title: nomeEvento.trim() }).eq('id', eventoId)

      if (tipoPessoa === 'pj' && orgId) {
        const orgUpdate: Record<string, unknown> = { phone: phone || null }
        if (orgTipo === 'estabelecimento') {
          Object.assign(orgUpdate, {
            zip_code:      zipCode      || null,
            street:        street       || null,
            street_number: streetNumber || null,
            neighborhood:  neighborhood || null,
            city:          city         || null,
            state:         uf           || null,
            complement:    complement   || null,
            capacity:      capacity ? parseInt(capacity) : null,
          })
        }
        await supabase.from('organizations').update(orgUpdate).eq('id', orgId)
      }

      router.push(`/criar-evento/${eventoId}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingFinal(false)
    }
  }

  // ── Indicador de etapa dinâmico ────────────────────────────────────────
  const StepDot = ({ n }: { n: number }) => (
    <div className={cn(
      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
      etapa === n ? 'bg-[#E8B84B] text-[#070707]'
        : etapa > n ? 'bg-green-500 text-white'
        : 'bg-[#1c1c1c] text-[#444]'
    )}>
      {etapa > n ? <CheckCircle2 size={12} /> : n}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">

        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

        <div className="p-6">

          {/* Indicador de etapas */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              {Array.from({ length: totalEtapas }, (_, i) => i + 1).map(n => (
                <div key={n} className="flex items-center gap-2">
                  <StepDot n={n} />
                  {n < totalEtapas && (
                    <div className={cn('w-8 h-px transition-colors', etapa > n ? 'bg-green-500' : 'bg-[#1c1c1c]')} />
                  )}
                </div>
              ))}
            </div>
            <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ══════════════════════════════════════════════
              ETAPA 1 — PF ou PJ
             ══════════════════════════════════════════════ */}
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
                      'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      tipoPessoa === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                        : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      tipoPessoa === value ? 'bg-[#E8B84B]/15' : 'bg-[#161616]')}>
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

              {erro && <p className="text-red-400 text-xs text-center mb-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

              <button type="button" onClick={handleSeguir} disabled={!tipoPessoa || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Seguir</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ══════════════════════════════════════════════
              ETAPA 2 (PF) — nome do evento
             ══════════════════════════════════════════════ */}
          {etapa === 2 && tipoPessoa === 'pf' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Sobre o evento</p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>Como seu evento se chama?</p>
              </div>

              <div className="mb-4">
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Rascunho criado e salvo automaticamente
                </p>
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleContinuar} disabled={savingFinal || !nomeEvento.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <><span>Continuar</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ══════════════════════════════════════════════
              ETAPA 2 (PJ) — tipo de empresa + dados
             ══════════════════════════════════════════════ */}
          {etapa === 2 && tipoPessoa === 'pj' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>Tipo de empresa</p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Como sua empresa atua no mercado de eventos?
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                {([
                  { value: 'promotora'      as const, icon: Users,  label: 'Promotor de eventos',  desc: 'Organiza eventos em espaços alugados'  },
                  { value: 'estabelecimento' as const, icon: MapPin, label: 'Estabelecimento',       desc: 'Tem espaço físico próprio para eventos' },
                ]).map(({ value, icon: Icon, label, desc }) => (
                  <button key={value} type="button" onClick={() => setOrgTipo(value)}
                    className={cn(
                      'flex items-center gap-4 p-4 rounded-xl border text-left transition-all',
                      orgTipo === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                        : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                    )}
                  >
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0',
                      orgTipo === value ? 'bg-[#E8B84B]/15' : 'bg-[#161616]')}>
                      <Icon size={16} className={orgTipo === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', orgTipo === value ? 'text-white' : 'text-[#777]')}
                         style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              {/* Dados da empresa — aparece após escolher o tipo */}
              {orgTipo && (
                <div className="flex flex-col gap-3 mb-4 pt-3 border-t border-[#1a1a1a]">
                  <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Dados da empresa
                  </p>
                  <input type="text" placeholder="Razão social *" value={razaoSocial}
                    onChange={e => setRazaoSocial(e.target.value)}
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  <input type="text" placeholder="CNPJ" value={cnpj}
                    onChange={e => setCnpj(formatCNPJ(e.target.value))}
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  <input type="text" placeholder="Nome fantasia" value={nomeFantasia}
                    onChange={e => setNomeFantasia(e.target.value)}
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                </div>
              )}

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleEtapa2PJ}
                disabled={!orgTipo || !razaoSocial.trim() || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Próximo</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ══════════════════════════════════════════════
              ETAPA 3 (PJ) — contato + endereço + evento
             ══════════════════════════════════════════════ */}
          {etapa === 3 && tipoPessoa === 'pj' && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {orgTipo === 'estabelecimento' ? 'Dados do local' : 'Contato e evento'}
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ background: 'rgba(232,184,75,0.10)', borderColor: 'rgba(232,184,75,0.30)', color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                    {orgTipo === 'promotora' ? 'T7-PRO' : 'T7-EST'}
                  </span>
                </div>
                {orgTipo === 'estabelecimento' && (
                  <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Dados pré-preenchidos do seu perfil — edite se o endereço do estabelecimento for diferente
                  </p>
                )}
              </div>

              <div className="flex flex-col gap-3 mb-4">

                {/* Telefone */}
                <input type="tel" placeholder="Telefone de contato" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />

                {/* Endereço — só para estabelecimento, pré-preenchido */}
                {orgTipo === 'estabelecimento' && (
                  <>
                    <div className="h-px bg-[#1a1a1a]" />
                    <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Endereço do estabelecimento
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <input type="text" placeholder="CEP" value={zipCode}
                        onChange={e => setZipCode(e.target.value)}
                        className={cn(inp, 'col-span-2')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                      <input type="text" placeholder="UF" value={uf} maxLength={2}
                        onChange={e => setUf(e.target.value.toUpperCase())}
                        className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    </div>
                    <input type="text" placeholder="Rua" value={street}
                      onChange={e => setStreet(e.target.value)}
                      className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    <div className="grid grid-cols-2 gap-2">
                      <input type="text" placeholder="Número" value={streetNumber}
                        onChange={e => setStreetNumber(e.target.value)}
                        className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                      <input type="text" placeholder="Bairro" value={neighborhood}
                        onChange={e => setNeighborhood(e.target.value)}
                        className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    </div>
                    <input type="text" placeholder="Cidade" value={city}
                      onChange={e => setCity(e.target.value)}
                      className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    <input type="text" placeholder="Complemento" value={complement}
                      onChange={e => setComplement(e.target.value)}
                      className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                    <input type="number" placeholder="Capacidade máxima (pessoas)" value={capacity}
                      onChange={e => setCapacity(e.target.value)}
                      className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  </>
                )}

                {/* Nome do evento */}
                <div className="h-px bg-[#1a1a1a]" />
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Código {orgTipo === 'promotora' ? 'T7-PRO' : 'T7-EST'} gerado com sucesso
                </p>
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleContinuar}
                disabled={savingFinal || !nomeEvento.trim()}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <><span>Continuar</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
