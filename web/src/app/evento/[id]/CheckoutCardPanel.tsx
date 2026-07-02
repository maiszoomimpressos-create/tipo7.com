'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { Loader2, X, CreditCard, AlertCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const ACCENT = '#E8B84B'

interface PayerCost {
  installments:       number
  installment_rate:   number
  installment_amount: number
  total_amount:       number
  recommended_message?: string
}

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

declare global {
  interface Window {
    MercadoPago: new (publicKey: string, opts: object) => {
      getInstallments: (params: object) => Promise<Array<{
        payment_method_id: string
        issuer?: { id: number }
        payer_costs: PayerCost[]
      }>>
      createCardToken: (params: object) => Promise<{ id?: string; error?: string; cause?: Array<{ code: string; description: string }> }>
    }
  }
}

export function CheckoutCardPanel({ eventoId, items, total, onClose }: Props) {
  const [sdkLoaded,    setSdkLoaded]    = useState(false)
  const [publicKey,    setPublicKey]    = useState<string | null>(null)
  const [configErr,    setConfigErr]    = useState<string | null>(null)
  const mpRef = useRef<InstanceType<typeof window.MercadoPago> | null>(null)

  // Card fields
  const [cardNumber, setCardNumber]   = useState('')
  const [cardName,   setCardName]     = useState('')
  const [expiry,     setExpiry]       = useState('')
  const [cvv,        setCvv]          = useState('')
  const [cpf,        setCpf]          = useState('')

  // Installments
  const [payerCosts,   setPayerCosts]   = useState<PayerCost[]>([])
  const [paymentMid,   setPaymentMid]   = useState('')  // payment_method_id (e.g. 'visa')
  const [issuerId,     setIssuerId]     = useState('')
  const [installments, setInstallments] = useState(1)
  const [loadingPc,    setLoadingPc]    = useState(false)
  const lastBin = useRef('')

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [error,      setError]      = useState<string | null>(null)

  // ── 1. Carrega SDK + public key em paralelo ───────────────────────────────

  useEffect(() => {
    let mounted = true

    // Carrega o SDK do Mercado Pago via script tag
    const loadSdk = new Promise<void>((resolve, reject) => {
      if (document.getElementById('mp-sdk')) { resolve(); return }
      const s = document.createElement('script')
      s.id  = 'mp-sdk'
      s.src = 'https://sdk.mercadopago.com/js/v2'
      s.onload  = () => resolve()
      s.onerror = () => reject(new Error('Falha ao carregar SDK do Mercado Pago'))
      document.head.appendChild(s)
    })

    // Busca a public key do promotor
    const loadConfig = fetch(`/api/checkout/mp-config?eventoId=${eventoId}`)
      .then(r => r.json() as Promise<{ publicKey?: string; error?: string }>)

    // Preenche CPF salvo no perfil
    const supabase = createClient()
    const loadCpf = supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data } = await supabase.from('profiles').select('cpf').eq('id', user.id).single()
      if (mounted && data?.cpf) setCpf(formatCpf(data.cpf))
    })

    Promise.all([loadSdk, loadConfig, loadCpf])
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
  }, [eventoId])

  // ── 2. Inicializa instância do MP quando SDK + key prontos ────────────────

  useEffect(() => {
    if (sdkLoaded && publicKey && !mpRef.current && window.MercadoPago) {
      mpRef.current = new window.MercadoPago(publicKey, { locale: 'pt-BR' })
    }
  }, [sdkLoaded, publicKey])

  // ── 3. Busca parcelas quando BIN muda ─────────────────────────────────────

  const fetchInstallments = useCallback(async (bin: string) => {
    if (!mpRef.current || bin.length < 6 || bin === lastBin.current) return
    lastBin.current = bin
    setLoadingPc(true)
    try {
      const data = await mpRef.current.getInstallments({
        amount:        String(total),
        bin:           bin,
        paymentTypeId: 'credit_card',
      })
      if (data?.[0]?.payer_costs?.length) {
        setPayerCosts(data[0].payer_costs)
        setPaymentMid(data[0].payment_method_id ?? '')
        setIssuerId(String(data[0].issuer?.id ?? ''))
        // Mantém a seleção atual se válida, senão volta para 1×
        setInstallments(prev => data[0].payer_costs.some(c => c.installments === prev) ? prev : 1)
      }
    } catch {
      // Ignora — parcelas ficam indisponíveis
    } finally {
      setLoadingPc(false)
    }
  }, [total])

  useEffect(() => {
    const bin = cardNumber.replace(/\s/g, '').slice(0, 6)
    if (bin.length === 6) fetchInstallments(bin)
    else if (bin.length < 6) { setPayerCosts([]); lastBin.current = '' }
  }, [cardNumber, fetchInstallments])

  // ── 4. Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!mpRef.current || submitting) return
    setError(null)

    // Validações básicas antes de tokenizar
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
      // Tokeniza o cartão via SDK — o token é de uso único e gerado pelo MP
      const tokenResult = await mpRef.current.createCardToken({
        cardNumber:           cleanCard,
        cardholderName:       cardName.trim().toUpperCase(),
        cardExpirationMonth:  mm,
        cardExpirationYear:   yy.length === 2 ? '20' + yy : yy,
        securityCode:         cvv,
        identificationType:   'CPF',
        identificationNumber: cleanCpf,
      })

      if (!tokenResult?.id) {
        const cause = tokenResult?.cause?.[0]?.description ?? 'Dados do cartão inválidos.'
        setError(cause)
        return
      }

      // Envia para o backend
      const res = await fetch('/api/checkout/card', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          eventoId,
          items,
          cardToken:       tokenResult.id,
          installments,
          issuerId,
          paymentMethodId: paymentMid,
          bin:             cleanCard.slice(0, 6),
        }),
      })

      const data = await res.json() as { orderId?: string; status?: string; error?: string }

      if (!res.ok) {
        setError(data.error ?? 'Pagamento recusado. Verifique os dados e tente novamente.')
        return
      }

      if (data.status === 'approved') {
        window.location.href = '/checkout/sucesso'
      } else if (data.status === 'rejected') {
        setError('Pagamento recusado pelo emissor do cartão. Verifique o limite disponível ou tente outro cartão.')
      } else {
        // in_process / pending — aguardando aprovação (ex: análise antifraude)
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

  const chosenCost = payerCosts.find(c => c.installments === installments)
  const totalDisplay = chosenCost?.total_amount ?? total

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

        {/* Parcelas */}
        <div>
          <label className={labelClass} style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {loadingPc
              ? <span className="flex items-center gap-1.5"><Loader2 size={11} className="animate-spin" /> Buscando parcelas...</span>
              : 'Parcelas'}
          </label>
          {payerCosts.length > 0 ? (
            <select
              value={installments}
              onChange={e => setInstallments(Number(e.target.value))}
              className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 cursor-pointer appearance-none"
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            >
              {payerCosts.map(c => (
                <option key={c.installments} value={c.installments}>
                  {c.installment_rate === 0
                    ? `${c.installments}x de ${brl(c.installment_amount)} (sem juros)`
                    : `${c.installments}x de ${brl(c.installment_amount)} = ${brl(c.total_amount)}`
                  }
                </option>
              ))}
            </select>
          ) : (
            <div className="w-full bg-[#0a0a0a] border border-[#1a1a1a] rounded-xl px-4 py-3 text-[#2e2e2e] text-sm"
                 style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {loadingPc ? '—' : 'Digite o número do cartão para ver as parcelas'}
            </div>
          )}
        </div>

        {/* Total */}
        <div className="flex items-center justify-between py-2 border-t border-[#111]">
          <span className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Total a pagar
          </span>
          <span className="text-white text-base font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {brl(totalDisplay)}
            {chosenCost && chosenCost.total_amount > total && (
              <span className="ml-1.5 text-xs text-[#444] font-normal">
                (valor de face {brl(total)})
              </span>
            )}
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
          disabled={submitting || !payerCosts.length}
          className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl text-sm font-semibold transition-all disabled:opacity-40 disabled:cursor-not-allowed"
          style={{
            background:  ACCENT,
            color:       '#070707',
            fontFamily:  'var(--font-dm-sans)',
          }}
        >
          {submitting
            ? <><Loader2 size={14} className="animate-spin" /> Processando...</>
            : `Confirmar pagamento · ${brl(totalDisplay)}`
          }
        </button>

        <p className="text-[#333] text-[10px] text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Seus dados são tokenizados pelo Mercado Pago. Não armazenamos dados do cartão.
        </p>
      </div>
    </form>
  )
}
