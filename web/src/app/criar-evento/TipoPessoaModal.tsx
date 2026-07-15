'use client'

// Modal de criação de evento — define tipo de pessoa e dados da empresa
// PF: 2 etapas | PJ: 3 etapas (tipo empresa → dados → contato/evento)
// Dados do perfil do usuário são pré-preenchidos automaticamente
import { useState, useEffect } from 'react'
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

interface OrgAtual {
  id:            string
  name:          string
  type:          'promotora' | 'estabelecimento'
  cnpj:          string | null
  nome_fantasia: string | null
}

interface Props {
  promotorId:      string | null
  tipoPessoaAtual: 'pf' | 'pj' | null
  nomeUsuario:     string
  orgAtual:        OrgAtual | null
  profile:         ProfileData
  onFechar:        () => void
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'
const inpError = 'w-full bg-[#111] border border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500/60 placeholder:text-[#383838]'

// ── Validação de CNPJ (dígitos verificadores) ──────────────────────────────
function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false
  const calc = (s: string, len: number) => {
    let sum = 0, pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(s[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return r
  }
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13])
}

const formatCNPJ = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 2)  return d
  if (d.length <= 5)  return `${d.slice(0,2)}.${d.slice(2)}`
  if (d.length <= 8)  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

const formatCEP = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 8)
  return d.length <= 5 ? d : `${d.slice(0,5)}-${d.slice(5)}`
}

export function TipoPessoaModal({ promotorId, tipoPessoaAtual, nomeUsuario, orgAtual, profile, onFechar }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const router    = useRouter()

  // Se o usuário já definiu tipo_pessoa, pula a etapa 1
  // PJ com CNPJ já preenchido → vai direto para etapa 3 (nome do evento)
  const orgJaCompleta = tipoPessoaAtual === 'pj' && !!orgAtual?.cnpj
  const etapaInicial: 1 | 2 | 3 = tipoPessoaAtual ? (orgJaCompleta ? 3 : 2) : 1

  const [etapa,         setEtapa]         = useState<1 | 2 | 3>(etapaInicial)
  const [inicializando, setInicializando] = useState(!!tipoPessoaAtual)
  const [tipoPessoa,    setTipoPessoa]    = useState<'pf' | 'pj' | ''>(tipoPessoaAtual ?? '')
  const [orgTipo,       setOrgTipo]       = useState<'promotora' | 'estabelecimento' | ''>(orgAtual?.type ?? '')
  const [orgId,         setOrgId]         = useState<string | null>(orgAtual?.id ?? null)
  const [eventoId,      setEventoId]      = useState<string | null>(null)

  const [saving,      setSaving]      = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Dados da empresa (etapa 2 PJ) — pré-preenchidos se org já existe
  const [razaoSocial,  setRazaoSocial]  = useState(tipoPessoaAtual === 'pj' ? (orgAtual?.name ?? '') : '')
  const [cnpj,         setCnpj]         = useState(orgAtual?.cnpj ? formatCNPJ(orgAtual.cnpj) : '')
  const [cnpjErro,     setCnpjErro]     = useState<string | null>(null)
  const [nomeFantasia, setNomeFantasia] = useState(orgAtual?.nome_fantasia ?? '')

  // Contato / endereço (etapa 3 PJ)
  const [phone,        setPhone]        = useState(profile.phone)
  // 'perfil' = usa endereço pessoal (somente leitura), 'outro' = endereço novo do estabelecimento
  const [enderecoOpcao, setEnderecoOpcao] = useState<'perfil' | 'outro'>('perfil')
  const [zipCode,      setZipCode]      = useState('')
  const [street,       setStreet]       = useState('')
  const [streetNumber, setStreetNumber] = useState('')
  const [neighborhood, setNeighborhood] = useState('')
  const [city,         setCity]         = useState('')
  const [uf,           setUf]           = useState('')
  const [complement,   setComplement]   = useState('')
  const [capacity,     setCapacity]     = useState('')
  const [cepLoading,   setCepLoading]   = useState(false)

  const [nomeEvento, setNomeEvento] = useState('')

  // Para usuários retornantes: cria o rascunho do evento silenciosamente ao abrir o modal
  useEffect(() => {
    if (!tipoPessoaAtual || !user) return
    ;(async () => {
      try {
        let newOrgId = orgAtual?.id ?? null
        if (!newOrgId) {
          const { data: orgEx } = await supabase.from('organizations').select('id').eq('owner_id', user.id).maybeSingle()
          if (orgEx) {
            newOrgId = orgEx.id
          } else {
            const { data: novaOrg, error: errOrg } = await supabase
              .from('organizations')
              .insert({ name: nomeUsuario, type: 'promotora', owner_id: user.id })
              .select('id').single()
            if (errOrg) throw errOrg
            newOrgId = novaOrg.id
          }
          setOrgId(newOrgId)
        }
        const { data: evento, error: errEvento } = await supabase
          .from('events')
          .insert({ organization_id: newOrgId, created_by: user.id, status: 'rascunho' })
          .select('id').single()
        if (errEvento) throw errEvento
        setEventoId(evento.id)
      } catch {
        setErro('Erro ao inicializar. Tente novamente.')
        setEtapa(1)
      } finally {
        setInicializando(false)
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const totalEtapas = tipoPessoa === 'pj' ? 3 : 2

  // ── Auto-preenchimento de CEP via ViaCEP ────────────────────────────────
  const buscarCEP = async (valor: string) => {
    const digitos = valor.replace(/\D/g, '')
    if (digitos.length !== 8) return
    setCepLoading(true)
    try {
      const res = await fetch(`https://viacep.com.br/ws/${digitos}/json/`)
      const d   = await res.json()
      if (!d.erro) {
        if (d.logradouro) setStreet(d.logradouro)
        if (d.bairro)     setNeighborhood(d.bairro)
        if (d.localidade) setCity(d.localidade)
        if (d.uf)         setUf(d.uf)
      }
    } catch { /* silently ignore */ }
    finally { setCepLoading(false) }
  }

  const handleCEP = (v: string) => {
    const f = formatCEP(v)
    setZipCode(f)
    if (f.replace(/\D/g,'').length === 8) buscarCEP(f)
  }

  // ── Validação de CNPJ ao sair do campo ─────────────────────────────────
  const handleCNPJBlur = () => {
    const digitos = cnpj.replace(/\D/g, '')
    if (!digitos) { setCnpjErro('CNPJ é obrigatório'); return }
    if (!validarCNPJ(cnpj)) { setCnpjErro('CNPJ inválido'); return }
    setCnpjErro(null)
  }

  // ── Etapa 1 → salva tipo_pessoa, cria org + rascunho ─────────────────
  const handleSeguir = async () => {
    if (!user || !tipoPessoa) return
    setSaving(true); setErro(null)
    try {
      if (promotorId) {
        await supabase.from('promotor_profiles').update({ tipo_pessoa: tipoPessoa }).eq('id', promotorId)
      } else {
        await supabase.from('promotor_profiles').insert({ user_id: user.id, tipo_pessoa: tipoPessoa })
      }

      const { data: orgExistente } = await supabase
        .from('organizations').select('id').eq('owner_id', user.id).maybeSingle()

      let newOrgId: string
      if (orgExistente) {
        newOrgId = orgExistente.id
      } else {
        const { data: novaOrg, error: errOrg } = await supabase
          .from('organizations')
          .insert({ name: nomeUsuario, type: 'promotora', owner_id: user.id })
          .select('id').single()
        if (errOrg) throw errOrg
        newOrgId = novaOrg.id
      }

      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({ organization_id: newOrgId, created_by: user.id, status: 'rascunho' })
        .select('id').single()
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

  // ── Etapa 2 (PJ) → valida CNPJ, salva dados da empresa + gera código ──
  const handleEtapa2PJ = async () => {
    if (!orgId || !orgTipo || !razaoSocial.trim()) return

    // CNPJ obrigatório e válido
    const cnpjDigitos = cnpj.replace(/\D/g, '')
    if (!cnpjDigitos) { setCnpjErro('CNPJ é obrigatório'); return }
    if (!validarCNPJ(cnpj)) { setCnpjErro('CNPJ inválido'); return }
    setCnpjErro(null)

    setSaving(true); setErro(null)
    try {
      // Verifica CNPJ duplicado
      const cnpjCheck = await fetch(`/api/check-cnpj?cnpj=${cnpjDigitos}`).then(r => r.json()) as { exists: boolean }
      if (cnpjCheck.exists) {
        setErro('Este CNPJ já está cadastrado na plataforma.')
        setSaving(false)
        return
      }

      const res    = await fetch(`/api/codigo?tipo=${orgTipo}`)
      const { codigo } = await res.json() as { codigo: string }

      const { error } = await supabase.from('organizations').update({
        name:          razaoSocial.trim(),
        type:          orgTipo,
        cnpj:          cnpjDigitos,
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

  // ── Etapa final → salva tudo → cria venue se estabelecimento → redireciona
  const handleContinuar = async () => {
    if (!eventoId || !nomeEvento.trim()) return
    setSavingFinal(true)
    try {
      await supabase.from('events').update({ title: nomeEvento.trim() }).eq('id', eventoId)

      if (tipoPessoa === 'pj' && orgId) {
        const orgUpdate: Record<string, unknown> = { phone: phone || null }

        if (orgTipo === 'estabelecimento') {
          // Usa endereço pessoal do perfil ou o endereço novo digitado
          const addrZip    = enderecoOpcao === 'perfil' ? profile.zip_code   : zipCode
          const addrStreet = enderecoOpcao === 'perfil' ? profile.street      : street
          const addrNum    = enderecoOpcao === 'perfil' ? profile.street_number : streetNumber
          const addrNeigh  = enderecoOpcao === 'perfil' ? profile.neighborhood : neighborhood
          const addrCity   = enderecoOpcao === 'perfil' ? profile.city        : city
          const addrUf     = enderecoOpcao === 'perfil' ? profile.state       : uf
          const addrComp   = enderecoOpcao === 'perfil' ? profile.complement  : complement

          Object.assign(orgUpdate, {
            zip_code:      addrZip.replace(/\D/g,'')  || null,
            street:        addrStreet                  || null,
            street_number: addrNum                     || null,
            neighborhood:  addrNeigh                   || null,
            city:          addrCity                    || null,
            state:         addrUf                      || null,
            complement:    addrComp                    || null,
            capacity:      capacity ? parseInt(capacity) : null,
          })

          // Salva como venue na plataforma
          const { data: venueExistente } = await supabase
            .from('venues')
            .select('id')
            .eq('owner_org_id', orgId)
            .is('google_place_id', null)
            .maybeSingle()

          const venueData = {
            name:          nomeFantasia.trim() || razaoSocial.trim(),
            zip_code:      addrZip.replace(/\D/g,'')  || null,
            street:        addrStreet                  || null,
            street_number: addrNum                     || null,
            neighborhood:  addrNeigh                   || null,
            city:          addrCity                    || null,
            state:         addrUf                      || null,
            complement:    addrComp                    || null,
            capacity:      capacity ? parseInt(capacity) : null,
            owner_org_id:  orgId,
          }

          if (venueExistente) {
            await supabase.from('venues').update(venueData).eq('id', venueExistente.id)
          } else {
            await supabase.from('venues').insert(venueData)
          }
        }

        await supabase.from('organizations').update(orgUpdate).eq('id', orgId)
      }

      router.push(`/criar-evento/${eventoId}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingFinal(false)
    }
  }

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

          {/* Loading enquanto cria o rascunho automaticamente */}
          {inicializando && (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 size={24} className="animate-spin" style={{ color: '#E8B84B' }} />
              <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Preparando seu evento...
              </p>
            </div>
          )}

          {/* ══ ETAPA 1 — PF ou PJ ══════════════════════════════════════════ */}
          {!inicializando && etapa === 1 && (
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
                    )}>
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

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleSeguir} disabled={!tipoPessoa || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Seguir</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ══ ETAPA 2 (PF) — nome do evento ═══════════════════════════════ */}
          {!inicializando && etapa === 2 && tipoPessoa === 'pf' && (
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

          {/* ══ ETAPA 2 (PJ) — tipo de empresa + dados ════════════════════ */}
          {!inicializando && etapa === 2 && tipoPessoa === 'pj' && (
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
                    )}>
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

              {/* Dados da empresa */}
              {orgTipo && (
                <div className="flex flex-col gap-3 mb-4 pt-3 border-t border-[#1a1a1a]">
                  <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Dados da empresa
                  </p>
                  <input type="text" placeholder="Razão social *" value={razaoSocial}
                    onChange={e => setRazaoSocial(e.target.value)}
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />

                  {/* CNPJ com validação */}
                  <div>
                    <input
                      type="text"
                      placeholder="CNPJ *"
                      value={cnpj}
                      onChange={e => { setCnpj(formatCNPJ(e.target.value)); setCnpjErro(null) }}
                      onBlur={handleCNPJBlur}
                      maxLength={18}
                      className={cnpjErro ? inpError : inp}
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                    {cnpjErro && (
                      <p className="text-red-400 text-xs mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{cnpjErro}</p>
                    )}
                    {!cnpjErro && cnpj.replace(/\D/g,'').length === 14 && validarCNPJ(cnpj) && (
                      <p className="text-green-400 text-xs mt-1 pl-1 flex items-center gap-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        <CheckCircle2 size={11} /> CNPJ válido
                      </p>
                    )}
                  </div>

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

          {/* ══ ETAPA 3 (PJ) — contato + endereço + evento ═══════════════ */}
          {!inicializando && etapa === 3 && tipoPessoa === 'pj' && (
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
              </div>

              <div className="flex flex-col gap-3 mb-4">

                <input type="tel" placeholder="Telefone de contato" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />

                {/* Endereço — só para estabelecimento */}
                {orgTipo === 'estabelecimento' && (
                  <>
                    <div className="h-px bg-[#1a1a1a]" />

                    {/* Aviso importante */}
                    <div className="flex items-start gap-2.5 px-3 py-2.5 rounded-xl"
                      style={{ background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.15)' }}>
                      <MapPin size={13} className="text-[#E8B84B] shrink-0 mt-0.5" />
                      <p className="text-[#888] text-xs leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        Este endereço será exibido aos compradores como localização do estabelecimento em eventos futuros.
                      </p>
                    </div>

                    {/* Seletor de endereço */}
                    <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Endereço do estabelecimento
                    </p>
                    <div className="grid grid-cols-2 gap-2">
                      {([
                        { value: 'perfil' as const, label: 'Meu endereço',  desc: 'Mesmo do cadastro' },
                        { value: 'outro'  as const, label: 'Outro endereço', desc: 'Endereço diferente' },
                      ]).map(({ value, label, desc }) => (
                        <button key={value} type="button" onClick={() => setEnderecoOpcao(value)}
                          className={cn(
                            'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                            enderecoOpcao === value
                              ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                              : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                          )}>
                          <span className={cn('text-xs font-medium', enderecoOpcao === value ? 'text-white' : 'text-[#666]')}
                            style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                          <span className="text-[#444] text-[10px] mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</span>
                        </button>
                      ))}
                    </div>

                    {/* Endereço do perfil — somente leitura */}
                    {enderecoOpcao === 'perfil' && (
                      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid #1a1a1a' }}>
                        <div className="px-3 py-2 border-b border-[#131313]" style={{ background: '#0a0a0a' }}>
                          <p className="text-[#333] text-[10px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            Endereço do perfil — somente leitura
                          </p>
                        </div>
                        <div className="px-3 py-3 space-y-1" style={{ background: '#0d0d0d' }}>
                          {[
                            profile.street && profile.street_number ? `${profile.street}, ${profile.street_number}` : profile.street,
                            profile.neighborhood,
                            profile.city && profile.state ? `${profile.city} — ${profile.state}` : profile.city,
                            profile.zip_code ? `CEP ${formatCEP(profile.zip_code)}` : null,
                            profile.complement || null,
                          ].filter(Boolean).map((linha, i) => (
                            <p key={i} className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{linha}</p>
                          ))}
                          {!profile.street && !profile.city && (
                            <p className="text-[#333] text-xs italic" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                              Endereço não preenchido no perfil
                            </p>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Endereço novo — editável com ViaCEP */}
                    {enderecoOpcao === 'outro' && (
                      <div className="flex flex-col gap-3">
                        <div className="relative">
                          <input
                            type="text"
                            inputMode="numeric"
                            placeholder="CEP *"
                            value={zipCode}
                            onChange={e => handleCEP(e.target.value)}
                            className={inp}
                            style={{ fontFamily: 'var(--font-dm-sans)' }}
                          />
                          {cepLoading && (
                            <Loader2 size={14} className="animate-spin text-[#E8B84B] absolute right-3.5 top-1/2 -translate-y-1/2" />
                          )}
                        </div>
                        <input type="text" placeholder="Rua *" value={street}
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
                        <div className="grid grid-cols-3 gap-2">
                          <input type="text" placeholder="Cidade *" value={city}
                            onChange={e => setCity(e.target.value)}
                            className={cn(inp, 'col-span-2')} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                          <input type="text" placeholder="UF" value={uf} maxLength={2}
                            onChange={e => setUf(e.target.value.toUpperCase())}
                            className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                        </div>
                        <input type="text" placeholder="Complemento (opcional)" value={complement}
                          onChange={e => setComplement(e.target.value)}
                          className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                      </div>
                    )}

                    <input type="number" placeholder="Capacidade máxima (pessoas)" value={capacity}
                      onChange={e => setCapacity(e.target.value)} min="1"
                      className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                  </>
                )}

                <div className="h-px bg-[#1a1a1a]" />
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Código {orgTipo === 'promotora' ? 'T7-PRO' : 'T7-EST'} gerado com sucesso
                  {orgTipo === 'estabelecimento' && ' — local salvo na plataforma'}
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
