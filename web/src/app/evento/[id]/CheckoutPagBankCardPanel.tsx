'use client'

import { useState, useEffect, useRef } from 'react'
import { Loader2, X, CreditCard, AlertCircle } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { getSession, initSession } from '@/lib/auth/session'

const ACCENT = '#E8B84B'

interface Props {
  eventoId: string
  items:    { ticketId: string; quantity: number }[]
  total:    number
  onClose:  () => void
}

// ── Formatters ────────────────────────────────────────────────────────────────

function brl(v: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v)
}

function formatCardNumber(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 16)
  return d.replace(/(\d{4})(?=\d)/g, '$1 ')
}

function formatExpiry(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 4)
  if (d.length > 2) return d.slice(0, 2) + '/' + d.slice(2)
  return d
}

function formatCpf(v: string) {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

function detectBrand(num: string): string | null {
  const n = num.replace(/\s/g, '')
  if (/^4/.test(n))           return 'Visa'
  if (/^5[1-5]/.test(n) || /^2(2[2-9]|[3-6]\d|7[01])/.test(n)) return 'Mastercard'
  if (/^3[47]/.test(n))       return 'Amex'
  if (/^6(36368|04175|011)/.test(n)) return 'Elo'
  if (/^(384100|384140|384160|606282)/.test(n)) return 'Hipercard'
  return null
}

// ── Componente principal ──────────────────────────────────────────────────────
// PagBank ainda não tem consulta pública de parcelas/juros como o Mercado
// Pago — por isso, por enquanto, só oferece pagamento à vista (1x). Parcelado
// fica pra quando pesquisarmos como calcular os juros certo.

declare global {
  interface Window {
    PagSeguro: {
      encryptCard: (params: {
        publicKey:    string
        holder:       string
        number:       string
        expMonth:     string
        expYear:      string
        securityCode: string
      }) => { encryptedCard?: string; hasErrors: boolean; errors?: Array<{ code: string; message: string }> }
    }
  }
}

export function CheckoutPagBankCardPanel({ eventoId, items, total, onClose }: Props) {
  const [sdkLoaded, setSdkLoaded] = useState(false)
  const [publicKey, setPublicKey] = useState<string | null>(null)
  const [configErr, setConfigErr] = useState<string | null>(null)

  // Card fields
  const [cardNumber, setCardNumber] = useState('')
  const [cardName,   setCardName]   = useState('')
  const [expiry,     setExpiry]     = useState('')
  const [cvv,        setCvv]        = useState('')
  const [cpf,        setCpf]        = useState('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const buyerEmailRef = useRef('')

  // ── 1. Carrega SDK + public key em paralelo ───────────────────────────────

  useEffect(() => {
    let mounted = true

    const loadSdk = new Promise<void>((resolve, reject) => {
      if (document.getElementById('pagbank-sdk')) { resolve(); return }
      const s = document.createElement('script')
      s.id  = 'pagbank-sdk'
      s.src = 'https://assets.pagseguro.com.br/checkout-sdk-js/rc/dist/browser/pagseguro.min.js'
      s.onload  = () => resolve()
      s.onerror = () => reject(new Error('Falha ao carregar SDK do PagBank'))
      document.head.appendChild(s)
    })

    const loadConfig = apiFetchAuth('/api/checkout/pagbank-config')
      .then(r => r.json() as Promise<{ publicKey?: string; error?: string }>)

    const loadProfile = initSession().then(async () => {
      const session = getSession()
      if (!session) return
      buyerEmailRef.current = session.user.email ?? ''
      const res = await apiFetchAuth('/api/profile')
      const data = res.ok ? await res.json() as { cpf: string | null } : null
      if (mounted && data?.cpf) setCpf(formatCpf(data.cpf))
    })

    Promise.all([loadSdk, loadConfig, loadProfile])
      .then(([, cfg]) => {
        if (!mounted) return
        if (!cfg.publicKey) { setConfigErr('Pagamento com cartão não disponível para este evento.'); return }
        setPublicKey(cfg.publicKey)
        setSdkLoaded(true)
      })
      .catch(() => {
        if (mounted) setConfigErr('Erro ao inicializar pagamento com cartão.')
      })

    return () => { mounted = false }
  }, [])

  // ── 2. Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!publicKey || submitting) return
    setError(null)

    const cleanCard = cardNumber.replace(/\s/g, '')
    const cleanCpf  = cpf.replace(/\D/g, '')
    const [mm, yy]  = expiry.split('/')

    if (cleanCard.length < 13) { setError('Número de cartão inválido.'); return }
    if (!cardName.trim())       { setError('Informe o nome como aparece no cartão.'); return }
    if (!mm || !yy || mm.length !== 2 || yy.length < 2) { setError('Data de vencimento inválida.'); return }
    if (cvv.length < 3)         { setError('CVV inválido.'); return }
    if (cleanCpf.length !== 11) { setError('CPF inválido.'); return }

    setSubmitting(true)
    try {
      const result = window.PagSeguro.encryptCard({
        publicKey,
        holder:       cardName.trim().toUpperCase(),
        number:       cleanCard,
        expMonth:     mm,
        expYear:      yy.length === 2 ? '20' + yy : yy,
        securityCode: cvv,
      })

      if (result.hasErrors || !result.encryptedCard) {
        setError(result.errors?.[0]?.message ?? 'Dados do cartão inválidos.')
        return
      }

      const res = await apiFetchAuth('/api/checkout/pagbank-card', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          eventoId,
          items,
          encryptedCard: result.encryptedCard,
          installments:  1,
          buyerName:     cardName.trim(),
          buyerEmail:    buyerEmailRef.current,
          cpf:           cleanCpf,
        }),
      })

      const data = await res.json() as { orderId?: string; status?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Pagamento recusado. Verifique os dados e tente novamente.')
        return
      }

      if (data.status === 'PAID' || data.status === 'AUTHORIZED') {
        window.location.href = '/checkout/sucesso'
      } else if (data.status === 'DECLINED') {
        setError('Pagamento recusado pelo emissor do cartão. Verifique o limite disponível ou tente outro cartão.')
      } else {
        // IN_ANALYSIS — aguardando aprovação (análise antifraude)
        window.location.href = '/checkout/pendente'
      }
    } catch {
      setError('Erro de conexão. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── UI ────────────────────────────────────────────────────────────────────

  const inputClass = `w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none
    focus:border-[#E8B84B]/40 placeholder:text-[#2e2e2e] transition-colors`
  const labelClass = `text-[#555] text-xs mb-1.5 block`

  const brand = detectBrand(cardNumber)

  if (configErr) {
    return (
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Cartão de crédito
          </p>
          <button onClick={onClose} className="text-[#444] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>
        <div className="flex items-start gap-2 text-sm text-red-400">
          <AlertCircle size={14} className="shrink-0 mt-0.5" />
          <p style={{ fontFamily: 'var(--font-dm-sans)' }}>{configErr}</p>
        </div>
      </div>
    )
  }

  if (!sdkLoaded || !publicKey) {
    return (
      <div className="rounded-2xl border border-[#1a1a1a] bg-[#0d0d0d] p-6 flex items-center justify-center gap-2 text-[#444]">
        <Loader2 size={14} className="animate-spin" />
        <span className="text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>Carregando...</span>
      </div>
    )
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-[#E8B84B]/15 bg-[#0d0d0d] overflow-hidden"
    >
      {/* Cabeçalho */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[#141414]">
        <div className="flex items-center gap-2">
          <CreditCard size={14} style={{ color: ACCENT }} />
          <p className="text-white text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Cartão de crédito
          </p>
          {brand && (
            <span className="text-[10px] px-2 py-0.5 rounded-full text-[#888] border border-[#222]"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {brand}
            </span>
          )}
        </div>
        <button type="button" onClick={onClose} className="text-[#444] hover:text-white transition-colors">
          <X size={15} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-4">

        {/* Número do cartão */}
        <div>
          <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Número do cartão
          </label>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="cc-number"
            placeholder="0000 0000 0000 0000"
            value={cardNumber}
            onChange={e => setCardNumber(formatCardNumber(e.target.value))}
            className={inputClass}
            style={{ fontFamily: 'var(--font-dm-sans)', letterSpacing: '0.05em' }}
          />
        </div>

        {/* Nome no cartão */}
        <div>
          <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Nome como aparece no cartão
          </label>
          <input
            type="text"
            autoComplete="cc-name"
            placeholder="NOME SOBRENOME"
            value={cardName}
            onChange={e => setCardName(e.target.value.toUpperCase())}
            className={inputClass}
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>

        {/* Validade + CVV */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Validade
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-exp"
              placeholder="MM/AA"
              value={expiry}
              onChange={e => setExpiry(formatExpiry(e.target.value))}
              className={inputClass}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
          <div>
            <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
              CVV
            </label>
            <input
              type="text"
              inputMode="numeric"
              autoComplete="cc-csc"
              placeholder="000"
              maxLength={4}
              value={cvv}
              onChange={e => setCvv(e.target.value.replace(/\D/g, '').slice(0, 4))}
              className={inputClass}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
        </div>

        {/* CPF */}
        <div>
          <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
            CPF do titular
          </label>
          <input
            type="text"
            inputMode="numeric"
            placeholder="000.000.000-00"
            value={cpf}
            onChange={e => setCpf(formatCpf(e.target.value))}
            className={inputClass}
            style={{ fontFamily: 'var(--font-dm-sans)' }}
          />
        </div>

        {/* Total — só à vista por enquanto (sem consulta de juros parcelado) */}
        <div className="flex items-center justify-between py-2 border-t border-[#111]">
          <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total a pagar (à vista)
          </span>
          <span className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {brl(total)}
          </span>
        </div>

        {/* Erro */}
        {error && (
          <div className="flex items-start gap-2 text-xs text-red-400 px-3 py-2.5 rounded-xl"
               style={{ background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)', fontFamily: 'var(--font-dm-sans)' }}>
            <AlertCircle size={12} className="shrink-0 mt-0.5" />
            {error}
          </div>
        )}

        {/* Botão */}
        <button
          type="submit"
          disabled={submitting}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:  ACCENT,
            color:       '#070707',
            fontFamily:  'var(--font-dm-sans)',
          }}
        >
          {submitting
            ? <><Loader2 size={14} className="animate-spin" /> Processando...</>
            : `Confirmar pagamento · ${brl(total)}`
          }
        </button>

        <p className="text-[#333] text-[10px] text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Seus dados são criptografados pelo PagBank. Não armazenamos dados do cartão.
        </p>
      </div>
    </form>
  )
}
