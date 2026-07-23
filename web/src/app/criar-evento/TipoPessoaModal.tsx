'use client'

// Modal de criação de evento — define tipo de organização e pessoa
// Fluxo novo:
//   Etapa 1: Promotor de eventos | Estabelecimento
//   Etapa 2 (Promotor): PF | PJ
//     PF → dados puxados do perfil → nome do evento
//     PJ → dados da empresa (CNPJ) → nome do evento
//   Etapa 2 (Estabelecimento): dados PJ + endereço → nome do evento
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'
import {
  Building2, User, Loader2, X, ArrowRight, CheckCircle2,
  MapPin, Users, ArrowLeft, Car, Ticket,
} from 'lucide-react'
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

type Stage =
  | 'org-tipo'       // Etapa 1: Promotor ou Estabelecimento
  | 'pf-pj'          // Etapa 2 (Promotor): PF ou PJ
  | 'dados-pj'       // Dados da empresa (CNPJ etc.)
  | 'contato-est'    // Endereço/telefone (Estabelecimento)
  | 'nome-evento'    // Nome do evento (etapa final)

const inp      = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]'
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

// ── O que esse evento vai vender — decide quais módulos ficam disponíveis ──
function SeletorModulos({
  ingressos, estacionamento, onIngressos, onEstacionamento,
}: {
  ingressos:        boolean
  estacionamento:   boolean
  onIngressos:      (v: boolean) => void
  onEstacionamento: (v: boolean) => void
}) {
  const opcoes = [
    { icon: Ticket, label: 'Ingressos',     desc: 'Vender ingressos online e presencial', checked: ingressos,      onChange: onIngressos },
    { icon: Car,    label: 'Estacionamento', desc: 'Vagas pagas no local',                  checked: estacionamento, onChange: onEstacionamento },
  ]
  return (
    <div className="mb-4">
      <p className="text-[#444] text-[11px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        O que esse evento vai ter
      </p>
      <div className="flex flex-col gap-2">
        {opcoes.map(({ icon: Icon, label, desc, checked, onChange }) => (
          <button key={label} type="button" onClick={() => onChange(!checked)}
            className={cn(
              'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
              checked ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35' : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
            )}>
            <div className={cn(
              'w-5 h-5 rounded-md border flex items-center justify-center shrink-0 transition-all',
              checked ? 'bg-[#E8B84B] border-[#E8B84B]' : 'border-[#333]'
            )}>
              {checked && <CheckCircle2 size={13} className="text-[#070707]" />}
            </div>
            <Icon size={15} className={checked ? 'text-[#E8B84B]' : 'text-[#444]'} />
            <div>
              <p className={cn('text-xs font-medium', checked ? 'text-white' : 'text-[#777]')}
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
              <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
            </div>
          </button>
        ))}
      </div>
    </div>
  )
}

export function TipoPessoaModal({ promotorId, tipoPessoaAtual, nomeUsuario, orgAtual, profile, onFechar }: Props) {
  const { user } = useAuth()
  const supabase  = createClient()
  const router    = useRouter()

  // Para retornante PJ completo: pula direto para nome do evento
  const pjRetornando = tipoPessoaAtual === 'pj' && !!orgAtual?.cnpj

  const etapaInicial: Stage = (() => {
    if (!tipoPessoaAtual) return 'org-tipo'
    if (tipoPessoaAtual === 'pf') return 'nome-evento'
    if (pjRetornando)              return 'nome-evento'
    return 'dados-pj' // PJ sem CNPJ → vai para dados da empresa
  })()

  const [stage,         setStage]         = useState<Stage>(etapaInicial)
  const [nicho,         setNicho]         = useState<'eventos' | 'estacionamento' | 'ambos' | ''>('')
  const [orgTipo,       setOrgTipo]       = useState<'promotora' | 'estabelecimento' | ''>(orgAtual?.type ?? '')
  const [tipoPessoa,    setTipoPessoa]    = useState<'pf' | 'pj' | ''>(tipoPessoaAtual ?? '')
  const [orgId,         setOrgId]         = useState<string | null>(orgAtual?.id ?? null)
  const [codigoGerado,  setCodigoGerado]  = useState<string | null>(null)

  const [saving,      setSaving]      = useState(false)
  const [savingFinal, setSavingFinal] = useState(false)
  const [erro,        setErro]        = useState<string | null>(null)

  // Dados da empresa
  const [razaoSocial,  setRazaoSocial]  = useState(tipoPessoaAtual === 'pj' ? (orgAtual?.name ?? '') : '')
  const [cnpj,         setCnpj]         = useState(orgAtual?.cnpj ? formatCNPJ(orgAtual.cnpj) : '')
  const [cnpjErro,     setCnpjErro]     = useState<string | null>(null)
  const [nomeFantasia, setNomeFantasia] = useState(orgAtual?.nome_fantasia ?? '')

  // Endereço (estabelecimento)
  const [phone,         setPhone]        = useState(profile.phone)
  const [enderecoOpcao, setEnderecoOpcao] = useState<'perfil' | 'outro'>('perfil')
  const [zipCode,       setZipCode]      = useState('')
  const [street,        setStreet]       = useState('')
  const [streetNumber,  setStreetNumber] = useState('')
  const [neighborhood,  setNeighborhood] = useState('')
  const [city,          setCity]         = useState('')
  const [uf,            setUf]           = useState('')
  const [complement,    setComplement]   = useState('')
  const [capacity,           setCapacity]           = useState('')
  const [temEstacionamento,  setTemEstacionamento]  = useState<'sim' | 'nao' | ''>('')
  const [estacionamentoVagas, setEstacionamentoVagas] = useState('')
  const [cepLoading,         setCepLoading]         = useState(false)

  const [nomeEvento, setNomeEvento] = useState('')

  // Módulos de venda do evento — Ingressos nasce ligado (comportamento histórico)
  const [moduloIngressos,      setModuloIngressos]      = useState(true)
  const [moduloEstacionamento, setModuloEstacionamento] = useState(false)
  const nenhumModuloSelecionado = !moduloIngressos && !moduloEstacionamento

  // ── Auto-preenchimento de CEP via ViaCEP ──────────────────────────────
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

  const handleCNPJBlur = () => {
    const digitos = cnpj.replace(/\D/g, '')
    if (!digitos) { setCnpjErro('CNPJ é obrigatório'); return }
    if (!validarCNPJ(cnpj)) { setCnpjErro('CNPJ inválido'); return }
    setCnpjErro(null)
  }

  // ── Salva tipo_pessoa via upsert (evita erro de chave duplicada) ──────
  const salvarTipoPessoa = async (tipo: 'pf' | 'pj') => {
    if (!user) return
    await supabase
      .from('promotor_profiles')
      .upsert({ user_id: user.id, tipo_pessoa: tipo }, { onConflict: 'user_id' })
  }

  // ── Cria ou atualiza a organização com tudo que foi preenchido até aqui.
  //     Só é chamada na ação final (usuário já nomeou o evento e confirmou) ──
  const salvarOrganizacao = async (): Promise<string> => {
    if (!user) throw new Error('Usuário não autenticado')

    if (tipoPessoa) await salvarTipoPessoa(tipoPessoa)

    const tipo  = orgTipo || orgAtual?.type || 'promotora'
    const isPJ  = tipo === 'estabelecimento' || tipoPessoa === 'pj'

    // Só inclui dados de PJ se o usuário realmente passou pela etapa "dados-pj"
    // nesta sessão do modal (retornantes com org já cadastrada pulam essa etapa).
    const dadosPJ: Record<string, unknown> = {}
    if (isPJ && codigoGerado) {
      dadosPJ.name          = razaoSocial.trim()
      dadosPJ.cnpj          = cnpj.replace(/\D/g, '')
      dadosPJ.nome_fantasia = nomeFantasia.trim() || null
      dadosPJ.codigo        = codigoGerado
    }

    // Nicho só é gravado se foi respondido nesta sessão do modal (retornantes pulam a pergunta)
    const camposNicho: Record<string, unknown> = nicho ? { nicho } : {}

    let finalOrgId = orgId
    if (!finalOrgId) {
      const { data: orgExistente } = await supabase.from('organizations').select('id').eq('owner_id', user.id).maybeSingle()
      if (orgExistente) {
        finalOrgId = orgExistente.id
        await supabase.from('organizations').update({ type: tipo, name: nomeUsuario, ...dadosPJ, ...camposNicho }).eq('id', finalOrgId)
      } else {
        const { data: novaOrg, error: errOrg } = await supabase
          .from('organizations')
          .insert({ owner_id: user.id, type: tipo, name: nomeUsuario, ...dadosPJ, ...camposNicho })
          .select('id').single()
        if (errOrg) throw errOrg
        finalOrgId = novaOrg.id
      }
    } else if (Object.keys(dadosPJ).length > 0 || Object.keys(camposNicho).length > 0) {
      await supabase.from('organizations').update({ ...dadosPJ, ...camposNicho }).eq('id', finalOrgId)
    }

    if (!finalOrgId) throw new Error('Falha ao criar organização')
    setOrgId(finalOrgId)
    return finalOrgId
  }

  // ── Etapa 1: usuário escolheu Organizador ou Estabelecimento ──────────
  const handleEscolhaTipo = () => {
    if (!orgTipo) return

    // O nicho escolhido define o valor inicial dos módulos — usuário ainda pode mudar depois
    if (nicho) {
      setModuloIngressos(nicho !== 'estacionamento')
      setModuloEstacionamento(nicho === 'estacionamento' || nicho === 'ambos')
    }

    if (orgTipo === 'promotora') {
      setStage('pf-pj')
      return
    }
    // Estabelecimento sempre emite como PJ — só estado local, nada no banco ainda
    setTipoPessoa('pj')
    setStage('dados-pj')
  }

  // ── Etapa 2 (Organizador): usuário escolheu PF ou PJ ─────────────────
  const handleEscolhaPFouPJ = (tipo: 'pf' | 'pj') => {
    setTipoPessoa(tipo)
    // PF: vai direto para nomear o evento (dados já puxados do perfil)
    // PJ: vai para preencher dados da empresa
    setStage(tipo === 'pf' ? 'nome-evento' : 'dados-pj')
  }

  // ── Dados da empresa (PJ promotora e Estabelecimento) — só validação,
  //     nada é gravado ainda; os valores ficam guardados em estado local ──
  const handleSalvarDadosPJ = async () => {
    if (!razaoSocial.trim()) return
    const cnpjDigitos = cnpj.replace(/\D/g, '')
    if (!cnpjDigitos) { setCnpjErro('CNPJ é obrigatório'); return }
    if (!validarCNPJ(cnpj)) { setCnpjErro('CNPJ inválido'); return }
    setCnpjErro(null)

    setSaving(true); setErro(null)
    try {
      // Verifica duplicata excluindo a própria org (evita erro ao voltar e reeditar)
      const cnpjUrl   = orgId
        ? `/api/check-cnpj?cnpj=${cnpjDigitos}&exclude_org=${orgId}`
        : `/api/check-cnpj?cnpj=${cnpjDigitos}`
      const cnpjCheck = await fetch(cnpjUrl).then(r => r.json()) as { exists: boolean }
      if (cnpjCheck.exists) {
        setErro('Este CNPJ já está cadastrado por outra empresa na plataforma.')
        setSaving(false); return
      }

      const res = await fetch(`/api/codigo?tipo=${orgTipo}`)
      const { codigo } = await res.json() as { codigo: string }
      setCodigoGerado(codigo)

      // Estabelecimento: precisa de endereço. Promotora PJ: vai direto para nome do evento
      setStage(orgTipo === 'estabelecimento' ? 'contato-est' : 'nome-evento')
    } catch {
      setErro('Erro ao verificar CNPJ. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  // ── Etapa final (Estabelecimento): grava organização + venue + evento ──
  // Liga o selo informativo "Estacionamento" (event_attributes) quando o módulo é ativado —
  // mostra na página pública do evento, mas não tem nenhuma lógica de venda por trás.
  const vincularAtributoEstacionamento = async (eventoId: string) => {
    const { data: attr } = await supabase
      .from('event_attributes').select('id').eq('name', 'Estacionamento').maybeSingle()
    if (attr) {
      await supabase.from('event_attribute_values')
        .upsert({ event_id: eventoId, attribute_id: attr.id }, { onConflict: 'event_id,attribute_id' })
    }
  }

  const handleSalvarContatoEst = async () => {
    if (!user || !nomeEvento.trim() || nenhumModuloSelecionado) return
    setSavingFinal(true); setErro(null)
    try {
      const finalOrgId = await salvarOrganizacao()

      const addrZip    = enderecoOpcao === 'perfil' ? profile.zip_code    : zipCode
      const addrStreet = enderecoOpcao === 'perfil' ? profile.street      : street
      const addrNum    = enderecoOpcao === 'perfil' ? profile.street_number : streetNumber
      const addrNeigh  = enderecoOpcao === 'perfil' ? profile.neighborhood : neighborhood
      const addrCity   = enderecoOpcao === 'perfil' ? profile.city        : city
      const addrUf     = enderecoOpcao === 'perfil' ? profile.state       : uf
      const addrComp   = enderecoOpcao === 'perfil' ? profile.complement  : complement

      await supabase.from('organizations').update({
        phone:         phone || null,
        zip_code:      addrZip.replace(/\D/g,'')  || null,
        street:        addrStreet                  || null,
        street_number: addrNum                     || null,
        neighborhood:  addrNeigh                   || null,
        city:          addrCity                    || null,
        state:         addrUf                      || null,
        complement:    addrComp                    || null,
        capacity:      capacity ? parseInt(capacity) : null,
      }).eq('id', finalOrgId)

      // Salva como venue
      const { data: venueExistente } = await supabase
        .from('venues').select('id').eq('owner_org_id', finalOrgId).is('google_place_id', null).maybeSingle()
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
        has_parking:   temEstacionamento === 'sim' ? true : temEstacionamento === 'nao' ? false : null,
        parking_spots: temEstacionamento === 'sim' && estacionamentoVagas ? parseInt(estacionamentoVagas) : null,
        owner_org_id:  finalOrgId,
      }
      if (venueExistente) {
        await supabase.from('venues').update(venueData).eq('id', venueExistente.id)
      } else {
        await supabase.from('venues').insert(venueData)
      }

      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({
          organization_id:       finalOrgId,
          created_by:            user.id,
          status:                'rascunho',
          title:                 nomeEvento.trim(),
          modulo_ingressos:      moduloIngressos,
          modulo_estacionamento: moduloEstacionamento,
        })
        .select('id').single()
      if (errEvento) throw errEvento
      if (moduloEstacionamento) await vincularAtributoEstacionamento(evento.id)

      router.push(`/criar-evento/${evento.id}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingFinal(false)
    }
  }

  // ── Etapa final (PF, PJ promotora, retornantes): grava organização + evento ──
  const handleSalvarNomeEvento = async () => {
    if (!user || !nomeEvento.trim() || nenhumModuloSelecionado) return
    setSavingFinal(true); setErro(null)
    try {
      const finalOrgId = await salvarOrganizacao()

      const { data: evento, error: errEvento } = await supabase
        .from('events')
        .insert({
          organization_id:       finalOrgId,
          created_by:            user.id,
          status:                'rascunho',
          title:                 nomeEvento.trim(),
          modulo_ingressos:      moduloIngressos,
          modulo_estacionamento: moduloEstacionamento,
        })
        .select('id').single()
      if (errEvento) throw errEvento
      if (moduloEstacionamento) await vincularAtributoEstacionamento(evento.id)

      router.push(`/criar-evento/${evento.id}`)
    } catch {
      setErro('Erro ao salvar. Tente novamente.')
      setSavingFinal(false)
    }
  }

  // ── Step indicator ─────────────────────────────────────────────────────
  const stagesSequence: Stage[] = (() => {
    if (!orgTipo && !tipoPessoa)                          return ['org-tipo', 'pf-pj', 'nome-evento']
    if (orgTipo === 'estabelecimento')                    return ['org-tipo', 'dados-pj', 'contato-est', 'nome-evento']
    if (orgTipo === 'promotora' && tipoPessoa === 'pj')   return ['org-tipo', 'pf-pj', 'dados-pj', 'nome-evento']
    return ['org-tipo', 'pf-pj', 'nome-evento']
  })()

  const stageIndex  = stagesSequence.indexOf(stage)
  const totalStages = stagesSequence.length

  const StepDots = () => (
    <div className="flex items-center gap-2">
      {stagesSequence.map((s, i) => {
        const done    = i < stageIndex
        const current = i === stageIndex
        return (
          <div key={s} className="flex items-center gap-2">
            <div className={cn(
              'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all',
              current ? 'bg-[#E8B84B] text-[#070707]'
                : done ? 'bg-green-500 text-white'
                : 'bg-[#1c1c1c] text-[#444]'
            )}>
              {done ? <CheckCircle2 size={12} /> : i + 1}
            </div>
            {i < stagesSequence.length - 1 && (
              <div className={cn('w-8 h-px transition-colors', done ? 'bg-green-500' : 'bg-[#1c1c1c]')} />
            )}
          </div>
        )
      })}
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto">

        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

        <div className="p-6">

          {/* Step dots */}
          <div className="flex items-center justify-between mb-5">
            <StepDots />
            <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors">
              <X size={16} />
            </button>
          </div>

          {/* ══ ETAPA 1: Promotor ou Estabelecimento ═══════════════════ */}
          {stage === 'org-tipo' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Como você vai criar eventos?
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Pode ser um evento pontual ou recorrente — não precisa ser profissional.
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-5">
                {([
                  {
                    value: 'promotora'       as const,
                    icon:  Users,
                    label: 'Organizador de eventos',
                    desc:  'Organizo eventos em locais variados — pode ser eventual ou frequente',
                  },
                  {
                    value: 'estabelecimento' as const,
                    icon:  MapPin,
                    label: 'Estabelecimento',
                    desc:  'Tenho um espaço físico próprio onde os eventos acontecem',
                  },
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

              <div className="mb-5">
                <p className="text-[#444] text-[11px] uppercase tracking-wider mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  O que você vai gerenciar aqui
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {([
                    { value: 'eventos'        as const, label: 'Eventos'        },
                    { value: 'estacionamento' as const, label: 'Estacionamento' },
                    { value: 'ambos'          as const, label: 'Ambos'          },
                  ]).map(({ value, label }) => (
                    <button key={value} type="button" onClick={() => setNicho(value)}
                      className={cn(
                        'py-2.5 rounded-xl border text-xs font-medium transition-all',
                        nicho === value
                          ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35 text-white'
                          : 'bg-[#111] border-[#1c1c1c] text-[#777] hover:border-[#2a2a2a]'
                      )}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleEscolhaTipo} disabled={!orgTipo || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Próximo</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

          {/* ══ ETAPA 2 (Promotor): PF ou PJ ═════════════════════════ */}
          {stage === 'pf-pj' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Como você vai organizar?
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Define como os ingressos e recibos serão emitidos.
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-5">
                {([
                  {
                    value: 'pf' as const,
                    icon:  User,
                    label: 'No meu nome (CPF)',
                    desc:  'Evento casual ou pontual — uso meus dados pessoais',
                    sub:   'Dados do cadastro puxados automaticamente, pronto em segundos',
                  },
                  {
                    value: 'pj' as const,
                    icon:  Building2,
                    label: 'Pela minha empresa (CNPJ)',
                    desc:  'Tenho CNPJ e quero emitir em nome da empresa',
                    sub:   'Vou informar razão social e CNPJ',
                  },
                ]).map(({ value, icon: Icon, label, desc, sub }) => (
                  <button key={value} type="button"
                    onClick={() => !saving && handleEscolhaPFouPJ(value)}
                    disabled={saving}
                    className={cn(
                      'flex items-start gap-4 p-4 rounded-xl border text-left transition-all',
                      tipoPessoa === value
                        ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                        : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]',
                      'disabled:opacity-50'
                    )}>
                    <div className={cn('w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5',
                      tipoPessoa === value ? 'bg-[#E8B84B]/15' : 'bg-[#161616]')}>
                      {saving && tipoPessoa === value
                        ? <Loader2 size={15} className="animate-spin text-[#E8B84B]" />
                        : <Icon size={16} className={tipoPessoa === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                      }
                    </div>
                    <div>
                      <p className={cn('text-sm font-medium', tipoPessoa === value ? 'text-white' : 'text-[#777]')}
                         style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
                      <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</p>
                      <p className="text-[#333] text-[10px] mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{sub}</p>
                    </div>
                  </button>
                ))}
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={() => setStage('org-tipo')}
                className="w-full text-center text-[#444] hover:text-[#777] text-xs transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft size={12} /> Voltar
              </button>
            </>
          )}

          {/* ══ DADOS DA EMPRESA (PJ promotora e Estabelecimento) ═════ */}
          {stage === 'dados-pj' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {orgTipo === 'estabelecimento' ? 'Dados do estabelecimento' : 'Dados da empresa'}
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Essas informações aparecerão nos ingressos emitidos.
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-5">
                <input type="text"
                  placeholder={orgTipo === 'estabelecimento' ? 'Razão social / Nome *' : 'Razão social *'}
                  value={razaoSocial}
                  onChange={e => setRazaoSocial(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />

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

                <input type="text" placeholder="Nome fantasia (opcional)" value={nomeFantasia}
                  onChange={e => setNomeFantasia(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleSalvarDadosPJ}
                disabled={!razaoSocial.trim() || saving}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2 mb-3"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {saving ? <Loader2 size={15} className="animate-spin" /> : <><span>Próximo</span><ArrowRight size={14} /></>}
              </button>

              <button type="button"
                onClick={() => setStage(orgTipo === 'estabelecimento' ? 'org-tipo' : 'pf-pj')}
                className="w-full text-center text-[#444] hover:text-[#777] text-xs transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft size={12} /> Voltar
              </button>
            </>
          )}

          {/* ══ CONTATO + ENDEREÇO (Estabelecimento) + NOME DO EVENTO ═ */}
          {stage === 'contato-est' && (
            <>
              <div className="mb-4">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Localização e contato
                  </p>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border"
                    style={{ background: 'rgba(232,184,75,0.10)', borderColor: 'rgba(232,184,75,0.30)', color: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                    T7-EST
                  </span>
                </div>
                <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  O endereço aparece para compradores como local dos eventos.
                </p>
              </div>

              <div className="flex flex-col gap-3 mb-4">
                <input type="tel" placeholder="Telefone de contato" value={phone}
                  onChange={e => setPhone(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />

                <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Endereço do estabelecimento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'perfil' as const, label: 'Meu endereço',   desc: 'Mesmo do cadastro' },
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

                {enderecoOpcao === 'outro' && (
                  <div className="flex flex-col gap-3">
                    <div className="relative">
                      <input type="text" inputMode="numeric" placeholder="CEP *" value={zipCode}
                        onChange={e => handleCEP(e.target.value)}
                        className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
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

                <p className="text-[#444] text-[11px] uppercase tracking-wider mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Estacionamento
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    { value: 'sim' as const, icon: Car,  label: 'Tem estacionamento', desc: 'Vagas disponíveis' },
                    { value: 'nao' as const, icon: X,    label: 'Sem estacionamento', desc: 'Não possui vagas'  },
                  ]).map(({ value, icon: Icon, label, desc }) => (
                    <button key={value} type="button" onClick={() => {
                      setTemEstacionamento(value)
                      if (value === 'nao') setEstacionamentoVagas('')
                    }}
                      className={cn(
                        'flex flex-col items-start p-3 rounded-xl border text-left transition-all',
                        temEstacionamento === value
                          ? 'bg-[#E8B84B]/8 border-[#E8B84B]/35'
                          : 'bg-[#111] border-[#1c1c1c] hover:border-[#2a2a2a]'
                      )}>
                      <div className="flex items-center gap-1.5 mb-0.5">
                        <Icon size={12} className={temEstacionamento === value ? 'text-[#E8B84B]' : 'text-[#444]'} />
                        <span className={cn('text-xs font-medium', temEstacionamento === value ? 'text-white' : 'text-[#666]')}
                          style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</span>
                      </div>
                      <span className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>{desc}</span>
                    </button>
                  ))}
                </div>

                {temEstacionamento === 'sim' && (
                  <input type="number" placeholder="Quantas vagas?" value={estacionamentoVagas}
                    onChange={e => setEstacionamentoVagas(e.target.value)} min="1"
                    className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
                )}

                <div className="h-px bg-[#1a1a1a]" />
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </div>

              <div className="flex items-center gap-2 bg-green-500/8 border border-green-500/20 rounded-xl px-3 py-2.5 mb-4">
                <CheckCircle2 size={13} className="text-green-400 shrink-0" />
                <p className="text-green-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Código T7-EST gerado — local salvo na plataforma
                </p>
              </div>

              <SeletorModulos
                ingressos={moduloIngressos} estacionamento={moduloEstacionamento}
                onIngressos={setModuloIngressos} onEstacionamento={setModuloEstacionamento}
              />
              {nenhumModuloSelecionado && (
                <p className="text-red-400 text-xs text-center mb-3">Selecione ao menos um item acima</p>
              )}

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleSalvarContatoEst}
                disabled={savingFinal || !nomeEvento.trim() || nenhumModuloSelecionado}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2 mb-3"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <><span>Continuar</span><ArrowRight size={14} /></>}
              </button>

              <button type="button" onClick={() => setStage('dados-pj')}
                className="w-full text-center text-[#444] hover:text-[#777] text-xs transition-colors flex items-center justify-center gap-1.5">
                <ArrowLeft size={12} /> Voltar
              </button>
            </>
          )}

          {/* ══ NOME DO EVENTO (PF, PJ promotora, e retornantes) ══════ */}
          {stage === 'nome-evento' && (
            <>
              <div className="mb-5">
                <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {pjRetornando ? 'Novo evento' : 'Quase lá!'}
                </p>
                <p className="text-[#555] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Qual é o nome do seu evento?
                </p>
              </div>

              {/* Banner: dados do organizador */}
              {pjRetornando ? (
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4"
                  style={{ background: 'rgba(232,184,75,0.06)', border: '1px solid rgba(232,184,75,0.20)' }}>
                  <CheckCircle2 size={13} className="shrink-0" style={{ color: '#E8B84B' }} />
                  <div>
                    <p className="text-[#E8B84B] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {orgAtual?.nome_fantasia || orgAtual?.name}
                    </p>
                    <p className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {orgAtual?.type === 'promotora' ? 'Promotora de eventos' : 'Estabelecimento'} · dados já salvos
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 mb-4"
                  style={{ background: '#0a0a0a', border: '1px solid #1a1a1a' }}>
                  {tipoPessoa === 'pf' ? (
                    <User size={13} className="shrink-0 text-[#555]" />
                  ) : (
                    <Building2 size={13} className="shrink-0 text-[#555]" />
                  )}
                  <div>
                    <p className="text-[#aaa] text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {tipoPessoa === 'pf' ? nomeUsuario : (razaoSocial || nomeUsuario)}
                    </p>
                    <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {tipoPessoa === 'pf' ? 'Promotor · Pessoa Física' : 'Promotor · Pessoa Jurídica'} · rascunho criado
                    </p>
                  </div>
                </div>
              )}

              <div className="mb-4">
                <input type="text" placeholder="Nome do evento *" value={nomeEvento}
                  onChange={e => setNomeEvento(e.target.value)}
                  className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} autoFocus />
              </div>

              <SeletorModulos
                ingressos={moduloIngressos} estacionamento={moduloEstacionamento}
                onIngressos={setModuloIngressos} onEstacionamento={setModuloEstacionamento}
              />
              {nenhumModuloSelecionado && (
                <p className="text-red-400 text-xs text-center mb-3">Selecione ao menos um item acima</p>
              )}

              {erro && <p className="text-red-400 text-xs text-center mb-3">{erro}</p>}

              <button type="button" onClick={handleSalvarNomeEvento}
                disabled={savingFinal || !nomeEvento.trim() || nenhumModuloSelecionado}
                className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-30 hover:brightness-110 transition-all flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
                {savingFinal ? <Loader2 size={15} className="animate-spin" /> : <><span>Criar evento</span><ArrowRight size={14} /></>}
              </button>
            </>
          )}

        </div>
      </div>
    </div>
  )
}
