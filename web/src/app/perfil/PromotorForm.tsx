'use client'

// Organizações que a pessoa administra. Não existe mais "a organização
// única" — a mesma pessoa pode administrar várias (ex: a mesma marca
// "Caldeirão" com CNPJ próprio em cada cidade), com participação diferente
// em cada uma (proprietário integral numa, sócio em outra). Documento é um
// campo só: 11 dígitos vira CPF (fica sem CNPJ, informal), 14 vira CNPJ —
// não pergunta PF ou PJ, o tamanho já diz.
import { useState, useRef, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import {
  Loader2, CheckCircle, AlertCircle, Building2, Plus,
  Users, Check, X, Camera, ChevronDown, Mail,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export interface OrganizacaoItem {
  id:            string
  codigo:        string | null
  name:          string
  cnpj:          string | null
  nome_fantasia: string | null
  logo_url:      string | null
  city:          string | null
  state:         string | null
  street:        string | null
  street_number: string | null
  neighborhood:  string | null
  zip_code:      string | null
  complement:    string | null
  phone:         string | null
  nicho:         string | null
  capacity:      number | null
  role:          string
  participacao:  'integral' | 'socio'
  percentual:    number | null
  status:        'ativo' | 'convidado'
}

interface Props {
  nomeUsuario:         string
  initialOrganizacoes: OrganizacaoItem[]
}

// ── Formatação/validação ────────────────────────────────────────────────────

// Documento único: até 11 dígitos vira máscara de CPF, 12+ vira CNPJ —
// a pessoa não escolhe, o tamanho do que ela digitou já identifica.
const formatDocumento = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 14)
  if (d.length <= 11) {
    if (d.length <= 3)  return d
    if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
    if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
    return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
  }
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`
}

const inp = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]'
const inpError = 'w-full bg-[#111] border border-red-500/40 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-red-500/60 placeholder:text-[#383838]'

interface FormState {
  documento:     string
  razaoSocial:   string
  nomeFantasia:  string
  phone:         string
  zipCode:       string
  street:        string
  streetNumber:  string
  neighborhood:  string
  city:          string
  state:         string
  complement:    string
  logoUrl:       string | null
}

const estadoVazio = (nome: string): FormState => ({
  documento: '', razaoSocial: nome, nomeFantasia: '', phone: '',
  zipCode: '', street: '', streetNumber: '', neighborhood: '', city: '', state: '', complement: '',
  logoUrl: null,
})

const estadoDeOrg = (o: OrganizacaoItem): FormState => ({
  documento:    o.cnpj ? formatDocumento(o.cnpj) : '',
  razaoSocial:  o.name ?? '',
  nomeFantasia: o.nome_fantasia ?? '',
  phone:        o.phone ?? '',
  zipCode:      o.zip_code ?? '',
  street:       o.street ?? '',
  streetNumber: o.street_number ?? '',
  neighborhood: o.neighborhood ?? '',
  city:         o.city ?? '',
  state:        o.state ?? '',
  complement:   o.complement ?? '',
  logoUrl:      o.logo_url,
})

type Aba = 'organizacoes' | 'socios' | 'pedidos'

export function PromotorForm({ nomeUsuario, initialOrganizacoes }: Props) {
  const router = useRouter()
  const [organizacoes, setOrganizacoes] = useState(initialOrganizacoes)
  const ativas    = organizacoes.filter(o => o.status === 'ativo')
  const convites  = organizacoes.filter(o => o.status === 'convidado')

  const [aba, setAba] = useState<Aba>('organizacoes')
  const [expandidoId, setExpandidoId] = useState<string | null>(null)
  const [criandoNova, setCriandoNova] = useState(false)
  const [respondendoId, setRespondendoId] = useState<string | null>(null)
  const [pedidosEnviados, setPedidosEnviados] = useState<PedidoEnviado[] | null>(null)
  const [sociosAtivos, setSociosAtivos] = useState<SocioAtivo[] | null>(null)
  const [socioSelecionado, setSocioSelecionado] = useState<SocioAtivo | null>(null)

  const recarregar = async () => {
    const res = await fetch('/api/organizations')
    const data = await res.json() as { organizacoes: OrganizacaoItem[] }
    setOrganizacoes(data.organizacoes ?? [])
    router.refresh()
  }

  const carregarPedidosEnviados = useCallback(async () => {
    const res  = await fetch('/api/organizations/pedidos-pendentes')
    const data = await res.json() as { pedidos?: PedidoEnviado[] }
    setPedidosEnviados(data.pedidos ?? [])
  }, [])

  const carregarSociosAtivos = useCallback(async () => {
    const res  = await fetch('/api/organizations/socios-ativos')
    const data = await res.json() as { socios?: SocioAtivo[] }
    setSociosAtivos(data.socios ?? [])
  }, [])

  useEffect(() => { if (aba === 'pedidos' && pedidosEnviados === null) carregarPedidosEnviados() }, [aba, pedidosEnviados, carregarPedidosEnviados])
  useEffect(() => { if (aba === 'socios' && sociosAtivos === null) carregarSociosAtivos() }, [aba, sociosAtivos, carregarSociosAtivos])

  const responderConvite = async (orgId: string, aceitar: boolean) => {
    setRespondendoId(orgId)
    try {
      await fetch(`/api/organizations/${orgId}/socios/responder`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ aceitar }),
      })
      await recarregar()
    } finally {
      setRespondendoId(null)
    }
  }

  const totalPedidos = convites.length + (pedidosEnviados?.length ?? 0)

  return (
    <div className="flex flex-col gap-5">

      {/* Tab bar */}
      <div className="flex gap-1 p-1 rounded-xl bg-[#0d0d0d] border border-[#1a1a1a] w-fit">
        <button type="button" onClick={() => setAba('organizacoes')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
            aba === 'organizacoes' ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'text-[#666] hover:text-[#999]'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <Building2 size={13} /> Organizações
        </button>
        <button type="button" onClick={() => setAba('socios')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
            aba === 'socios' ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'text-[#666] hover:text-[#999]'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <Users size={13} /> Sócios
          {sociosAtivos && sociosAtivos.length > 0 && (
            <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold"
              style={{ background: aba === 'socios' ? '#E8B84B' : '#1c1c1c', color: aba === 'socios' ? '#070707' : '#888' }}>
              {sociosAtivos.length}
            </span>
          )}
        </button>
        <button type="button" onClick={() => setAba('pedidos')}
          className={cn(
            'flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all',
            aba === 'pedidos' ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'text-[#666] hover:text-[#999]'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}>
          <Mail size={13} /> Pedidos pendentes
          {totalPedidos > 0 && (
            <span className="flex items-center justify-center min-w-[16px] h-[16px] px-1 rounded-full text-[10px] font-bold"
              style={{ background: aba === 'pedidos' ? '#E8B84B' : '#1c1c1c', color: aba === 'pedidos' ? '#070707' : '#888' }}>
              {totalPedidos}
            </span>
          )}
        </button>
      </div>

      {/* ── Aba: Organizações ── */}
      {aba === 'organizacoes' && (
        <div className="flex flex-col gap-4">
          {ativas.map(org => (
            <OrganizacaoCard
              key={org.id}
              org={org}
              expandido={expandidoId === org.id}
              onToggle={() => setExpandidoId(prev => prev === org.id ? null : org.id)}
              onSalvo={recarregar}
            />
          ))}

          {criandoNova ? (
            <OrganizacaoCard
              org={null}
              nomeUsuario={nomeUsuario}
              expandido
              onToggle={() => setCriandoNova(false)}
              onSalvo={async () => { setCriandoNova(false); await recarregar() }}
            />
          ) : (
            <button type="button" onClick={() => setCriandoNova(true)}
              className="flex items-center justify-center gap-2 text-[#666] hover:text-[#E8B84B] text-sm border border-dashed border-[#222] hover:border-[#E8B84B]/30 rounded-2xl px-4 py-4 transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <Plus size={14} /> Nova organização
            </button>
          )}

          {ativas.length === 0 && !criandoNova && (
            <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Por padrão, seus eventos são emitidos no seu nome, com seu CPF. Crie uma organização se você tem uma casa de show, empresa, ou vai administrar um lugar com CNPJ próprio.
            </p>
          )}
        </div>
      )}

      {/* ── Aba: Sócios — quem já aceitou administrar, com dados completos ── */}
      {aba === 'socios' && (
        <div className="flex flex-col gap-2.5">
          {sociosAtivos === null && (
            <Loader2 size={14} className="animate-spin text-[#E8B84B] mx-auto my-6" />
          )}
          {sociosAtivos?.length === 0 && (
            <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nenhum sócio ainda — só você administra suas organizações.
            </p>
          )}
          {sociosAtivos && sociosAtivos.length > 0 && (
            <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
              {sociosAtivos.map(s => (
                <button key={s.id} type="button" onClick={() => setSocioSelecionado(s)}
                  className="w-full flex items-center gap-3 px-4 py-3 border-b border-[#111] last:border-0 text-left hover:bg-white/[0.03] transition-colors">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-[#070707] shrink-0"
                    style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}>
                    {(s.nome ?? s.codigo ?? '?').charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 min-w-0 text-white text-sm truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {s.nome ?? s.codigo ?? 'Pessoa'}{s.voceMesmo && <span className="text-[#444]"> (você)</span>}
                  </span>
                  <ChevronDown size={13} className="text-[#444] -rotate-90 shrink-0" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {socioSelecionado && (
        <SocioDetalheModal socio={socioSelecionado} onFechar={() => setSocioSelecionado(null)} />
      )}

      {/* ── Aba: Pedidos pendentes (recebidos + enviados) ── */}
      {aba === 'pedidos' && (
        <div className="flex flex-col gap-5">

          {convites.length > 0 && (
            <div className="flex flex-col gap-2.5">
              <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Convites recebidos
              </p>
              {convites.map(c => (
                <div key={c.id} className="rounded-2xl border border-[#E8B84B]/25 bg-[#E8B84B]/[0.04] p-4 flex items-center gap-3">
                  <Mail size={16} className="text-[#E8B84B] shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Convite: {c.nome_fantasia || c.name}
                    </p>
                    <p className="text-[#888] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Você foi convidado(a) como {c.participacao === 'integral' ? 'proprietário integral' : `sócio${c.percentual ? ` (${c.percentual}%)` : ''}`}
                    </p>
                  </div>
                  <div className="flex gap-2 shrink-0">
                    <button type="button" disabled={respondendoId === c.id} onClick={() => responderConvite(c.id, true)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center bg-[#E8B84B] text-[#070707] disabled:opacity-50">
                      {respondendoId === c.id ? <Loader2 size={13} className="animate-spin" /> : <Check size={14} />}
                    </button>
                    <button type="button" disabled={respondendoId === c.id} onClick={() => responderConvite(c.id, false)}
                      className="w-8 h-8 rounded-lg flex items-center justify-center border border-[#222] text-[#666] hover:text-white disabled:opacity-50">
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="flex flex-col gap-2.5">
            <p className="text-[#444] text-[11px] uppercase tracking-wider" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Convites enviados aguardando resposta
            </p>
            {pedidosEnviados === null && (
              <Loader2 size={14} className="animate-spin text-[#E8B84B] mx-auto my-4" />
            )}
            {pedidosEnviados?.length === 0 && (
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Nenhum convite de sócio esperando resposta no momento.
              </p>
            )}
            {pedidosEnviados?.map(p => (
              <div key={p.id} className="flex items-center justify-between gap-2 bg-[#111] border border-[#1c1c1c] rounded-xl px-3 py-2.5">
                <div className="min-w-0">
                  <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.nome ?? p.codigo ?? 'Pessoa'}
                  </p>
                  <p className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {p.organizacao} · {p.participacao === 'integral' ? 'Proprietário integral' : `Sócio${p.percentual ? ` · ${p.percentual}%` : ''}`}
                  </p>
                </div>
                <span className="text-[#444] text-[10px] shrink-0" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Aguardando
                </span>
              </div>
            ))}
          </div>

          {convites.length === 0 && pedidosEnviados?.length === 0 && (
            <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Nenhum pedido pendente no momento.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── Modal de detalhes de um sócio ─────────────────────────────────────────

function SocioDetalheModal({ socio, onFechar }: { socio: SocioAtivo; onFechar: () => void }) {
  const linha = (label: string, valor: string | null) => (
    <div className="flex flex-col gap-1.5">
      <span className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        {label}
      </span>
      <div className="bg-[#111] border border-[#222] rounded-xl px-3 py-2.5">
        <span className="text-white text-sm break-all" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {valor ?? '—'}
        </span>
      </div>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm" onClick={onFechar}>
      <div className="w-full max-w-sm bg-[#0d0d0d] border border-[#1c1c1c] rounded-2xl shadow-2xl shadow-black/60 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
        <div className="h-[2px]" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />
        <div className="p-6 flex flex-col gap-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-[#070707] shrink-0"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}>
                {(socio.nome ?? socio.codigo ?? '?').charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="text-white text-base font-medium break-words" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {socio.nome ?? 'Sem nome'}
                </p>
                {socio.voceMesmo && (
                  <span className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>você</span>
                )}
              </div>
            </div>
            <button onClick={onFechar} className="text-[#444] hover:text-[#777] transition-colors shrink-0">
              <X size={16} />
            </button>
          </div>

          <div className="flex flex-col gap-4">
            {linha('E-mail', socio.email)}
            {linha('Código T7', socio.codigo)}
            {linha('Organização', socio.organizacao)}
            {linha('Participação', socio.participacao === 'integral' ? 'Proprietário integral' : `Sócio${socio.percentual ? ` · ${socio.percentual}%` : ''}`)}
          </div>

          <button type="button" onClick={onFechar}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] hover:brightness-110 transition-all"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
            Fechar
          </button>
        </div>
      </div>
    </div>
  )
}

interface SocioAtivo {
  id:           string
  organizacao:  string
  participacao: 'integral' | 'socio'
  percentual:   number | null
  nome:         string | null
  codigo:       string | null
  email:        string | null
  voceMesmo:    boolean
}

interface PedidoEnviado {
  id:           string
  organizacao:  string
  participacao: 'integral' | 'socio'
  percentual:   number | null
  nome:         string | null
  codigo:       string | null
  criadoEm:     string
}

// ─── Card de uma organização (existente ou nova) ───────────────────────────

function OrganizacaoCard({
  org, nomeUsuario, expandido, onToggle, onSalvo,
}: {
  org:          OrganizacaoItem | null
  nomeUsuario?: string
  expandido:    boolean
  onToggle:     () => void
  onSalvo:      () => void | Promise<void>
}) {
  const supabase = createClient()
  const isNova = !org

  const [form, setForm] = useState<FormState>(org ? estadoDeOrg(org) : estadoVazio(nomeUsuario ?? ''))
  const [docErro, setDocErro] = useState<string | null>(null)
  const [logoPreview, setLogoPreview] = useState(org?.logo_url ?? null)
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [uploadingLogo, setUploadingLogo] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [saving,  setSaving]  = useState(false)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [mostrarSocios, setMostrarSocios] = useState(false)

  const set = <K extends keyof FormState>(k: K, v: FormState[K]) => setForm(f => ({ ...f, [k]: v }))

  const handleLogoFile = (file: File) => {
    if (file.size > 2 * 1024 * 1024) { setError('Logo muito grande. O limite é 2MB.'); return }
    setLogoFile(file)
    const reader = new FileReader()
    reader.onload = ev => setLogoPreview(ev.target?.result as string)
    reader.readAsDataURL(file)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null); setSuccess(false)

    const digitos = form.documento.replace(/\D/g, '')
    if (digitos && digitos.length !== 11 && digitos.length !== 14) {
      setDocErro('Documento deve ter 11 dígitos (CPF) ou 14 (CNPJ)')
      return
    }
    if (!form.razaoSocial.trim() && !form.nomeFantasia.trim()) {
      setError('Informe um nome pra organização.')
      return
    }
    setDocErro(null)
    setSaving(true)

    try {
      // Se tem organização (ou vai criar uma) e escolheu logo nova, sobe
      // primeiro pro Storage — path exige organization_id, então numa
      // organização nova o upload acontece só depois do POST criar o id.
      let logoUrl = form.logoUrl

      const salvarLogo = async (orgId: string) => {
        if (!logoFile) return
        setUploadingLogo(true)
        try {
          const ext  = logoFile.name.split('.').pop() ?? 'jpg'
          const path = `${orgId}/logo.${ext}`
          const { error: upErr } = await supabase.storage
            .from('organization-logos')
            .upload(path, logoFile, { upsert: true, contentType: logoFile.type })
          if (upErr) throw upErr
          const { data } = supabase.storage.from('organization-logos').getPublicUrl(path)
          logoUrl = `${data.publicUrl}?t=${Date.now()}`
        } finally {
          setUploadingLogo(false)
        }
      }

      const payload = {
        documento:    form.documento,
        razaoSocial:  form.razaoSocial,
        nomeFantasia: form.nomeFantasia,
        phone:        form.phone,
        zipCode:      form.zipCode,
        street:       form.street,
        streetNumber: form.streetNumber,
        neighborhood: form.neighborhood,
        city:         form.city,
        state:        form.state,
        complement:   form.complement,
        logoUrl,
      }

      if (isNova) {
        const res  = await fetch('/api/organizations', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json() as { organizacao?: { id: string }; error?: string }
        if (!res.ok || !data.organizacao) { setError(data.error ?? 'Erro ao criar organização.'); return }
        await salvarLogo(data.organizacao.id)
        if (logoFile) {
          await fetch(`/api/organizations/${data.organizacao.id}`, {
            method: 'PUT', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...payload, logoUrl }),
          })
        }
      } else {
        await salvarLogo(org.id)
        const res  = await fetch(`/api/organizations/${org.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, logoUrl }),
        })
        const data = await res.json() as { error?: string }
        if (!res.ok) { setError(data.error ?? 'Erro ao salvar.'); return }
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3000)
      await onSalvo()
    } catch {
      setError('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] overflow-hidden">
      {/* Cabeçalho — sempre visível, clicável */}
      <button type="button" onClick={onToggle}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition-colors">
        <div className="w-9 h-9 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-[#161616]">
          {org?.logo_url
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={org.logo_url} alt="" className="w-full h-full object-cover" />
            : <Building2 size={16} className="text-[#444]" />
          }
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {isNova ? 'Nova organização' : (org.nome_fantasia || org.name)}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            {!isNova && org.codigo && (
              <span className="text-[#E8B84B]/70 text-[11px] font-mono" style={{ fontFamily: 'var(--font-dm-sans)' }}>{org.codigo}</span>
            )}
            {!isNova && org.city && (
              <span className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>· {org.city}</span>
            )}
            {!isNova && (
              <span className={cn(
                'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                org.participacao === 'integral' ? 'bg-[#E8B84B]/10 text-[#E8B84B]' : 'bg-white/5 text-[#888]'
              )} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {org.participacao === 'integral' ? 'Proprietário integral' : 'Sócio'}
              </span>
            )}
          </div>
        </div>
        <ChevronDown size={15} className={cn('text-[#444] transition-transform shrink-0', expandido && 'rotate-180')} />
      </button>

      {expandido && (
        <form onSubmit={handleSave} className="px-5 pb-5 flex flex-col gap-4 border-t border-[#141414] pt-4">

          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="w-14 h-14 rounded-xl overflow-hidden shrink-0 flex items-center justify-center bg-[#111] border border-[#222]">
              {logoPreview
                // eslint-disable-next-line @next/next/no-img-element
                ? <img src={logoPreview} alt="" className="w-full h-full object-cover" />
                : <Building2 size={18} className="text-[#333]" />
              }
            </div>
            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={uploadingLogo}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-[#222] text-[#888] hover:text-white hover:border-[#333] text-xs transition-all"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {uploadingLogo ? <Loader2 size={12} className="animate-spin" /> : <Camera size={12} />}
              {logoPreview ? 'Trocar logo' : 'Adicionar logo'}
            </button>
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) handleLogoFile(f) }} />
          </div>

          <Field label="Documento (CPF ou CNPJ)" optional>
            <input type="text" value={form.documento}
              onChange={e => { set('documento', formatDocumento(e.target.value)); setDocErro(null) }}
              placeholder="Digite o CPF ou CNPJ — identificamos automaticamente"
              className={docErro ? inpError : inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            {docErro && <p className="text-red-400 text-xs mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{docErro}</p>}
            <p className="text-[#3a3a3a] text-[11px] mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Sem CNPJ, a organização fica informal — emitida no CPF de quem administra.
            </p>
          </Field>

          <Field label="Razão social / nome">
            <input type="text" value={form.razaoSocial} onChange={e => set('razaoSocial', e.target.value)}
              placeholder="Ex: Caldeirão Eventos LTDA" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          </Field>

          <Field label="Nome fantasia" optional>
            <input type="text" value={form.nomeFantasia} onChange={e => set('nomeFantasia', e.target.value)}
              placeholder='Ex: Caldeirão Casa de Shows' className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          </Field>

          <Field label="Telefone" optional>
            <input type="text" value={form.phone} onChange={e => set('phone', e.target.value)}
              placeholder="(00) 00000-0000" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="CEP" optional>
              <input type="text" value={form.zipCode} onChange={e => set('zipCode', e.target.value)}
                placeholder="00000-000" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </Field>
            <Field label="Cidade" optional>
              <input type="text" value={form.city} onChange={e => set('city', e.target.value)}
                placeholder="Cidade" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </Field>
          </div>

          <Field label="Rua" optional>
            <input type="text" value={form.street} onChange={e => set('street', e.target.value)}
              placeholder="Rua / Avenida" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="Número" optional>
              <input type="text" value={form.streetNumber} onChange={e => set('streetNumber', e.target.value)}
                placeholder="123" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
            </Field>
            <div className="col-span-2">
              <Field label="Bairro" optional>
                <input type="text" value={form.neighborhood} onChange={e => set('neighborhood', e.target.value)}
                  placeholder="Bairro" className={inp} style={{ fontFamily: 'var(--font-dm-sans)' }} />
              </Field>
            </div>
          </div>

          <Field label="Estado" optional>
            <input type="text" value={form.state} onChange={e => set('state', e.target.value.toUpperCase().slice(0, 2))}
              placeholder="UF" maxLength={2} className={inp} style={{ fontFamily: 'var(--font-dm-sans)', width: 80 }} />
          </Field>

          {error && (
            <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <AlertCircle size={14} className="shrink-0" />{error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 text-green-400 text-sm bg-green-400/8 border border-green-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <CheckCircle size={14} className="shrink-0" />Salvo!
            </div>
          )}

          <button type="submit" disabled={saving || uploadingLogo}
            className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2"
            style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
            {saving ? <><Loader2 size={15} className="animate-spin" /> Salvando...</> : isNova ? 'Criar organização' : 'Salvar alterações'}
          </button>

          {/* Sócios — só pra organização já existente */}
          {!isNova && (
            <div className="border-t border-[#141414] pt-4">
              <button type="button" onClick={() => setMostrarSocios(v => !v)}
                className="flex items-center gap-2 text-[#888] hover:text-white text-xs transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}>
                <Users size={13} /> Quem administra essa organização
                <ChevronDown size={12} className={cn('transition-transform', mostrarSocios && 'rotate-180')} />
              </button>
              {mostrarSocios && <SociosPainel orgId={org.id} />}
            </div>
          )}
        </form>
      )}
    </div>
  )
}

function Field({ label, optional, children }: { label: string; optional?: boolean; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase flex justify-between" style={{ fontFamily: 'var(--font-dm-sans)' }}>
        <span>{label}</span>
        {optional && <span className="text-[#383838] normal-case tracking-normal">opcional</span>}
      </label>
      {children}
    </div>
  )
}

// ─── Painel de sócios/administradores de uma organização ───────────────────

interface Socio {
  id: string; userId: string; role: string
  participacao: 'integral' | 'socio'; percentual: number | null; status: 'ativo' | 'convidado'
  nome: string | null; codigo: string | null
}

function SociosPainel({ orgId }: { orgId: string }) {
  const [socios, setSocios]         = useState<Socio[] | null>(null)
  const [carregando, setCarregando] = useState(true)
  const [identificador, setIdentificador] = useState('')
  const [participacao, setParticipacao]   = useState<'integral' | 'socio'>('socio')
  const [percentual, setPercentual]       = useState('')
  const [percentualErro, setPercentualErro] = useState<string | null>(null)
  const [convidando, setConvidando] = useState(false)
  const [msg, setMsg] = useState<{ tipo: 'erro' | 'ok'; texto: string } | null>(null)

  const carregar = useCallback(async () => {
    setCarregando(true)
    const res  = await fetch(`/api/organizations/${orgId}/socios`)
    const data = await res.json() as { socios?: Socio[] }
    setSocios(data.socios ?? [])
    setCarregando(false)
  }, [orgId])

  useEffect(() => { carregar() }, [carregar])

  const convidar = async () => {
    if (!identificador.trim()) return
    setPercentualErro(null)

    const pctNum = Number(percentual.replace(',', '.'))
    if (participacao === 'socio' && (!percentual.trim() || !Number.isFinite(pctNum) || pctNum <= 0 || pctNum > 100)) {
      setPercentualErro('Informe a porcentagem de participação (entre 0 e 100)')
      return
    }

    setConvidando(true); setMsg(null)
    try {
      const res  = await fetch(`/api/organizations/${orgId}/socios`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identificador: identificador.trim(),
          participacao,
          percentual: participacao === 'socio' ? pctNum : undefined,
        }),
      })
      const data = await res.json() as { ok?: boolean; nome?: string; error?: string }
      if (!res.ok) { setMsg({ tipo: 'erro', texto: data.error ?? 'Erro ao convidar.' }); return }
      setMsg({ tipo: 'ok', texto: `Convite enviado${data.nome ? ` pra ${data.nome}` : ''}.` })
      setIdentificador('')
      setPercentual('')
      await carregar()
    } finally {
      setConvidando(false)
    }
  }

  return (
    <div className="mt-3 flex flex-col gap-2.5">
      {carregando && <Loader2 size={14} className="animate-spin text-[#E8B84B] mx-auto my-2" />}

      {!carregando && (socios ?? []).map(s => (
        <div key={s.id} className="flex items-center justify-between gap-2 bg-[#111] border border-[#1c1c1c] rounded-xl px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-white text-xs font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {s.nome ?? s.codigo ?? 'Pessoa'}
            </p>
            <p className="text-[#555] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {s.participacao === 'integral' ? 'Proprietário integral' : 'Sócio'}
              {s.percentual != null && ` · ${s.percentual}%`}
              {s.status === 'convidado' && ' · convite pendente'}
            </p>
          </div>
        </div>
      ))}

      <div className="flex flex-col gap-2 pt-1">
        <div className="flex gap-2">
          <input type="text" value={identificador} onChange={e => setIdentificador(e.target.value)}
            placeholder="CPF, código T7 ou e-mail da pessoa"
            className="flex-1 bg-[#111] border border-[#222] rounded-xl px-3 py-2.5 text-white text-xs outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
            style={{ fontFamily: 'var(--font-dm-sans)' }} />
          <select value={participacao} onChange={e => { setParticipacao(e.target.value as 'integral' | 'socio'); setPercentualErro(null) }}
            className="bg-[#111] border border-[#222] rounded-xl px-2.5 py-2.5 text-white text-xs outline-none focus:border-[#E8B84B]/40"
            style={{ fontFamily: 'var(--font-dm-sans)' }}>
            <option value="socio">Sócio</option>
            <option value="integral">Integral</option>
          </select>
        </div>
        {participacao === 'socio' && (
          <div>
            <div className="relative">
              <input type="text" inputMode="decimal" value={percentual}
                onChange={e => { setPercentual(e.target.value.replace(/[^0-9,.]/g, '')); setPercentualErro(null) }}
                placeholder="Porcentagem de participação (ex: 30)"
                className={cn(
                  'w-full bg-[#111] border rounded-xl px-3 py-2.5 pr-8 text-white text-xs outline-none placeholder:text-[#383838]',
                  percentualErro ? 'border-red-500/40 focus:border-red-500/60' : 'border-[#222] focus:border-[#E8B84B]/40'
                )}
                style={{ fontFamily: 'var(--font-dm-sans)' }} />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#555] text-xs">%</span>
            </div>
            {percentualErro && (
              <p className="text-red-400 text-[11px] mt-1 pl-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>{percentualErro}</p>
            )}
          </div>
        )}
        <button type="button" onClick={convidar} disabled={convidando || !identificador.trim()}
          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold text-[#070707] disabled:opacity-40"
          style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}>
          {convidando ? <Loader2 size={12} className="animate-spin" /> : 'Convidar'}
        </button>
        {msg && (
          <p className={cn('text-xs', msg.tipo === 'erro' ? 'text-red-400' : 'text-green-400')} style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {msg.texto}
          </p>
        )}
      </div>
    </div>
  )
}
