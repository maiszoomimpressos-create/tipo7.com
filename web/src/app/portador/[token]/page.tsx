'use client'

// Página pública (sem login) — quem recebe o link de convite de um pedido
// com vários ingressos abre isso pra reivindicar um dos slots restantes e
// preencher os próprios dados. Pedido do usuário, 09/08/2026.
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Ticket, CalendarDays, MapPin, Loader2, CheckCircle2, XCircle, Users, Mail, MessageCircle } from 'lucide-react'

const MESES = ['jan','fev','mar','abr','mai','jun','jul','ago','set','out','nov','dez']
function formatDate(iso: string | null) {
  if (!iso) return null
  const d = new Date(iso)
  return `${d.getDate()} de ${MESES[d.getMonth()]} de ${d.getFullYear()}`
}

const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}
const formatBirthDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}
const isValidCPF = (v: string) => {
  const d = v.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i)
  let r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  if (r !== +d[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i)
  r = (s * 10) % 11
  if (r === 10 || r === 11) r = 0
  return r === +d[10]
}
function displayToISO(display: string) {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

interface LinkInfo {
  event_title:     string
  date_start:      string | null
  venue_name:      string | null
  city:            string | null
  state:           string | null
  banner_url:      string | null
  slots_restantes: number
}

const inputCls = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]'
const labelCls = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

export default function PortadorLinkPage() {
  const { token } = useParams<{ token: string }>()

  const [info,    setInfo]    = useState<LinkInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [erroInfo, setErroInfo] = useState<string | null>(null)

  useEffect(() => {
    fetch(`/api/public/holder-links/${token}`)
      .then(async res => {
        if (!res.ok) {
          const d = await res.json().catch(() => null) as { message?: string } | null
          throw new Error(d?.message ?? 'Link inválido.')
        }
        return res.json() as Promise<LinkInfo>
      })
      .then(setInfo)
      .catch(err => setErroInfo(err instanceof Error ? err.message : 'Link inválido.'))
      .finally(() => setLoading(false))
  }, [token])

  // ── Formulário ──────────────────────────────────────────────
  const [fullName,  setFullName]  = useState('')
  const [cpf,        setCpf]       = useState('')
  const [email,      setEmail]     = useState('')
  const [phone,      setPhone]     = useState('')
  const [birthDate,  setBirthDate] = useState('')

  const [cpfBuscando,   setCpfBuscando]   = useState(false)
  const [cpfEncontrado, setCpfEncontrado] = useState(false)
  const [cpfConfirmado, setCpfConfirmado] = useState(false)
  const [dicaTelefone,  setDicaTelefone]  = useState<string | null>(null)
  const [dicaEmail,     setDicaEmail]     = useState<string | null>(null)
  const [valorConfirmacao, setValorConfirmacao] = useState('')
  const [confirmando,   setConfirmando]   = useState(false)
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null)

  const [enviando, setEnviando] = useState(false)
  const [erroEnvio, setErroEnvio] = useState<string | null>(null)
  const [resultado, setResultado] = useState<{ ticket_name: string } | null>(null)

  async function handleBlurCpf() {
    setCpfEncontrado(false); setDicaTelefone(null); setDicaEmail(null)
    setValorConfirmacao(''); setErroConfirmacao(null); setCpfConfirmado(false)
    if (!isValidCPF(cpf)) return
    setCpfBuscando(true)
    try {
      const res = await fetch('/api/auth/cpf-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf }),
      })
      const data = await res.json() as { found: boolean; telefoneMascarado: string | null; emailMascarado: string | null }
      if (data.found) {
        setCpfEncontrado(true)
        setDicaTelefone(data.telefoneMascarado)
        setDicaEmail(data.emailMascarado)
      }
    } catch {
      // best-effort — segue preenchimento manual
    } finally {
      setCpfBuscando(false)
    }
  }

  async function handleConfirmarCpf() {
    if (!valorConfirmacao.trim()) return
    setConfirmando(true); setErroConfirmacao(null)
    try {
      const res = await fetch('/api/auth/cpf-confirmar', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cpf, valor: valorConfirmacao }),
      })
      const data = await res.json() as {
        ok: boolean
        dados?: { fullName: string | null; email: string | null; phone: string | null; birthDate: string | null }
      }
      if (!data.ok || !data.dados) {
        setErroConfirmacao('Não conseguimos confirmar com esse dado. Confira e tente de novo, ou preencha manualmente.')
        return
      }
      const d = data.dados
      if (d.fullName)  setFullName(d.fullName)
      if (d.email)     setEmail(d.email)
      if (d.phone)     setPhone(formatPhone(d.phone))
      if (d.birthDate) setBirthDate(formatBirthDate(d.birthDate.split('-').reverse().join('')))
      setCpfConfirmado(true)
    } catch {
      setErroConfirmacao('Erro ao confirmar. Tente de novo.')
    } finally {
      setConfirmando(false)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setErroEnvio(null)
    if (!fullName.trim() || !isValidCPF(cpf) || !email.includes('@') || phone.replace(/\D/g, '').length < 10 || !birthDate) {
      setErroEnvio('Preencha todos os campos corretamente.')
      return
    }
    setEnviando(true)
    try {
      const res = await fetch(`/api/public/holder-links/${token}/reivindicar`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name:  fullName.trim(),
          cpf:        cpf.replace(/\D/g, ''),
          email:      email.trim(),
          phone:      phone.replace(/\D/g, ''),
          birth_date: displayToISO(birthDate),
        }),
      })
      const data = await res.json().catch(() => null) as { message?: string; ticket_name?: string } | null
      if (!res.ok) {
        setErroEnvio(data?.message ?? 'Não foi possível confirmar. Tente de novo.')
        return
      }
      setResultado({ ticket_name: data?.ticket_name ?? 'Ingresso' })
    } catch {
      setErroEnvio('Erro de conexão. Tente de novo.')
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex flex-col items-center justify-center px-4 py-12">

      <div className="flex items-center gap-2 mb-8">
        <Ticket size={20} style={{ color: '#E8B84B' }} />
        <span className="text-xl" style={{ fontFamily: 'var(--font-syne)', fontWeight: 700 }}>
          <span className="text-white">tipo</span>
          <span style={{ color: '#E8B84B' }}>7</span>
        </span>
      </div>

      <div className="w-full max-w-sm">

        {loading && (
          <div className="flex flex-col items-center gap-4 py-16">
            <Loader2 size={28} className="animate-spin" style={{ color: '#E8B84B' }} />
          </div>
        )}

        {!loading && erroInfo && (
          <div className="text-center py-12">
            <XCircle size={40} className="mx-auto mb-3 text-red-400" />
            <p className="text-white text-sm mb-2" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erroInfo}</p>
            <a href="/" className="text-[#E8B84B] text-xs underline underline-offset-2">Voltar ao início</a>
          </div>
        )}

        {!loading && info && !resultado && info.slots_restantes <= 0 && (
          <div className="text-center py-12 flex flex-col items-center gap-3">
            <Users size={36} className="text-[#333]" />
            <p className="text-white text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Todos os ingressos desse convite já foram reivindicados.
            </p>
            <a href="/" className="text-[#E8B84B] text-xs underline underline-offset-2">Voltar ao início</a>
          </div>
        )}

        {!loading && info && resultado && (
          <div className="text-center py-10 flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <CheckCircle2 size={32} className="text-green-400" />
            </div>
            <div>
              <p className="text-white text-lg font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Ingresso confirmado!
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {resultado.ticket_name} · {info.event_title}
              </p>
            </div>
            <div className="w-full rounded-xl border border-[#1a1a1a] bg-[#0a0a0a] p-4 flex flex-col gap-2.5 text-left">
              <div className="flex items-center gap-2.5">
                <MessageCircle size={14} className="text-[#25D366] shrink-0" />
                <p className="text-[#ccc] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Mandamos seu ingresso por WhatsApp e email.
                </p>
              </div>
              <div className="flex items-center gap-2.5">
                <Mail size={14} className="text-[#E8B84B] shrink-0" />
                <p className="text-[#ccc] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  Criamos um cadastro Tipo7 com esse email. Se precisar acessar de novo, use{' '}
                  <a href="/auth/recuperar" className="text-[#E8B84B] underline underline-offset-2">Esqueci minha senha</a>.
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && info && !resultado && info.slots_restantes > 0 && (
          <div className="flex flex-col gap-5">

            {/* Cabeçalho do evento */}
            <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid #1a1a1a', background: '#0d0d0d' }}>
              {info.banner_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={info.banner_url} alt={info.event_title} className="w-full object-cover" style={{ aspectRatio: '780/300' }} />
              )}
              <div className="p-4">
                <h1 className="text-white text-lg leading-snug mb-1.5" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 600 }}>
                  {info.event_title}
                </h1>
                <div className="flex flex-col gap-1">
                  {info.date_start && (
                    <div className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <CalendarDays size={11} /> {formatDate(info.date_start)}
                    </div>
                  )}
                  {(info.venue_name || info.city) && (
                    <div className="flex items-center gap-1.5 text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <MapPin size={11} /> {[info.venue_name, info.city, info.state].filter(Boolean).join(' · ')}
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="text-center">
              <p className="text-white text-base font-semibold mb-1" style={{ fontFamily: 'var(--font-outfit)' }}>
                Um dos ingressos é seu?
              </p>
              <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Preencha seus dados pra reivindicar o seu ({info.slots_restantes} {info.slots_restantes === 1 ? 'disponível' : 'disponíveis'}).
              </p>
            </div>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">

              {/* CPF primeiro — igual ao cadastro, tenta pré-preencher o resto */}
              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>CPF</label>
                <div className="relative">
                  <input
                    type="text" inputMode="numeric" value={cpf} disabled={cpfConfirmado}
                    onChange={e => setCpf(formatCPF(e.target.value))}
                    onBlur={handleBlurCpf}
                    placeholder="000.000.000-00" maxLength={14} autoComplete="off"
                    className={`${inputCls} disabled:opacity-60`} style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {cpfBuscando && <Loader2 size={14} className="animate-spin absolute right-3.5 top-1/2 -translate-y-1/2 text-[#555]" />}
                </div>
                {cpfConfirmado && (
                  <p className="text-[11px]" style={{ color: '#4ade80', fontFamily: 'var(--font-dm-sans)' }}>
                    Encontramos seu cadastro e preenchemos seus dados.
                  </p>
                )}
              </div>

              {cpfEncontrado && !cpfConfirmado && (
                <div className="flex flex-col gap-2 p-3 rounded-xl" style={{ background: '#111', border: '1px solid #222' }}>
                  <p className="text-[#999] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Encontramos um cadastro com esse CPF. Pra confirmar que é você, digite seu telefone ou email completo:
                  </p>
                  <p className="text-[#555] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    {[dicaTelefone, dicaEmail].filter(Boolean).join(' ou ')}
                  </p>
                  <input
                    type="text" value={valorConfirmacao} onChange={e => setValorConfirmacao(e.target.value)}
                    placeholder="Seu telefone ou email completo"
                    className="w-full bg-[#0a0a0a] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {erroConfirmacao && <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erroConfirmacao}</p>}
                  <button
                    type="button" onClick={handleConfirmarCpf} disabled={confirmando || !valorConfirmacao.trim()}
                    className="w-full py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-40 flex items-center justify-center gap-2"
                    style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {confirmando ? <Loader2 size={15} className="animate-spin" /> : 'Confirmar'}
                  </button>
                  <button
                    type="button" onClick={() => { setCpfEncontrado(false); setDicaTelefone(null); setDicaEmail(null) }}
                    className="text-[#555] hover:text-[#888] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Prefiro preencher manualmente
                  </button>
                </div>
              )}

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nome completo</label>
                <input
                  type="text" value={fullName} onChange={e => setFullName(e.target.value)}
                  placeholder="Seu nome completo" className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Email</label>
                <input
                  type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="seu@email.com" className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>WhatsApp</label>
                <input
                  type="text" inputMode="numeric" value={phone} onChange={e => setPhone(formatPhone(e.target.value))}
                  placeholder="(00) 00000-0000" maxLength={15} className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <p className="text-[#444] text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  É pra onde vamos mandar seu ingresso.
                </p>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Data de nascimento</label>
                <input
                  type="text" inputMode="numeric" value={birthDate} onChange={e => setBirthDate(formatBirthDate(e.target.value))}
                  placeholder="DD/MM/AAAA" maxLength={10} className={inputCls} style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
              </div>

              {erroEnvio && (
                <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {erroEnvio}
                </div>
              )}

              <button
                type="submit" disabled={enviando}
                className="w-full py-3.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60 flex items-center justify-center gap-2"
                style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
              >
                {enviando ? <Loader2 size={15} className="animate-spin" /> : 'Confirmar meu ingresso'}
              </button>
            </form>
          </div>
        )}

      </div>
    </div>
  )
}
