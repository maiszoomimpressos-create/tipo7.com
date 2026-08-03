'use client'

import { useState, useRef } from 'react'
import { Check, Loader2, RefreshCw, Info, AlertTriangle, Wallet, Eye, EyeOff, ShieldCheck, ImagePlus } from 'lucide-react'
import { cn } from '@/lib/utils'

const ACCENT = '#E8B84B'

interface MpCredenciais {
  accessToken:   string
  publicKey:     string
  clientId:      string
  clientSecret:  string
  webhookSecret: string
}

interface Props {
  platformFeePct: string
  descPlataforma: string
  pctPix:         string
  pctDebito:      string
  pctCredito1x:   string
  pctCredito6x:   string
  pctCredito12x:  string
  notaExtra:      string
  mpCredenciais:  MpCredenciais
  logoMercadoPago: string | null
  logoPagbank:     string | null
}

async function saveCredKey(key: string, value: string) {
  return fetch('/api/admin/payment-credentials', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ [key]: value }),
  })
}

type MpRates = {
  pix: string; debito: string
  credito_1x: string; credito_6x: string; credito_12x: string
}

async function saveKey(key: string, value: string) {
  return fetch('/api/admin/settings', {
    method:  'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ [key]: value }),
  })
}

export function BancosClient(props: Props) {
  const [aba, setAba] = useState<'tarifas' | 'gateways'>('tarifas')

  // Aba Gateways — qual banco está com o painel de credenciais aberto
  const [gatewayAberto, setGatewayAberto] = useState<'mercadopago' | 'pagbank' | null>(null)
  const [mostrarSegredos, setMostrarSegredos] = useState(false)

  // Logo de cada gateway — enviada pelo admin, substitui o ícone genérico no seletor
  const [logoMp,       setLogoMp]       = useState(props.logoMercadoPago)
  const [logoPagbank,  setLogoPagbank]  = useState(props.logoPagbank)
  const [uploadingLogo, setUploadingLogo] = useState<'mercadopago' | 'pagbank' | null>(null)
  const logoInputRef = useRef<HTMLInputElement>(null)
  const [gatewayDoUpload, setGatewayDoUpload] = useState<'mercadopago' | 'pagbank' | null>(null)

  function pedirLogo(gateway: 'mercadopago' | 'pagbank') {
    setGatewayDoUpload(gateway)
    logoInputRef.current?.click()
  }

  async function enviarLogo(file: File) {
    const gateway = gatewayDoUpload
    if (!gateway) return
    setUploadingLogo(gateway)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('gateway', gateway)
      const res  = await fetch('/api/admin/gateway-logo', { method: 'POST', body: fd })
      const data = await res.json()
      if (res.ok) {
        if (gateway === 'mercadopago') setLogoMp(data.url)
        else setLogoPagbank(data.url)
      }
    } finally {
      setUploadingLogo(null)
    }
  }
  const [mpAccessToken,   setMpAccessToken]   = useState(props.mpCredenciais.accessToken)
  const [mpPublicKey,     setMpPublicKey]     = useState(props.mpCredenciais.publicKey)
  const [mpClientId,      setMpClientId]      = useState(props.mpCredenciais.clientId)
  const [mpClientSecret,  setMpClientSecret]  = useState(props.mpCredenciais.clientSecret)
  const [mpWebhookSecret, setMpWebhookSecret] = useState(props.mpCredenciais.webhookSecret)
  const [credSaving, setCredSaving] = useState(false)
  const [credSaved,  setCredSaved]  = useState(false)

  async function salvarCredenciaisMp() {
    setCredSaving(true); setCredSaved(false)
    try {
      await Promise.all([
        saveCredKey('mp_access_token',   mpAccessToken.trim()),
        saveCredKey('mp_public_key',     mpPublicKey.trim()),
        saveCredKey('mp_client_id',      mpClientId.trim()),
        saveCredKey('mp_client_secret',  mpClientSecret.trim()),
        saveCredKey('mp_webhook_secret', mpWebhookSecret.trim()),
      ])
      setCredSaved(true)
      setTimeout(() => setCredSaved(false), 2500)
    } finally {
      setCredSaving(false)
    }
  }

  const [descPlat,    setDescPlat]    = useState(props.descPlataforma)
  const [pix,         setPix]         = useState(props.pctPix)
  const [debito,      setDebito]      = useState(props.pctDebito)
  const [cred1x,      setCred1x]      = useState(props.pctCredito1x)
  const [cred6x,      setCred6x]      = useState(props.pctCredito6x)
  const [cred12x,     setCred12x]     = useState(props.pctCredito12x)
  const [notaExtra,   setNotaExtra]   = useState(props.notaExtra)

  const [saving,      setSaving]      = useState(false)
  const [saved,       setSaved]       = useState(false)
  const [fetchingMp,  setFetchingMp]  = useState(false)
  const [mpInfo,      setMpInfo]      = useState<{ email?: string; id?: number } | null>(null)
  const [mpErr,       setMpErr]       = useState<string | null>(null)

  async function salvarTudo() {
    setSaving(true); setSaved(false)
    try {
      await Promise.all([
        saveKey('fee_desc_plataforma', descPlat.trim()),
        saveKey('fee_pct_pix',         pix.trim()),
        saveKey('fee_pct_debito',       debito.trim()),
        saveKey('fee_pct_credito_1x',   cred1x.trim()),
        saveKey('fee_pct_credito_6x',   cred6x.trim()),
        saveKey('fee_pct_credito_12x',  cred12x.trim()),
        saveKey('fee_nota_extra',        notaExtra.trim()),
      ])
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } finally {
      setSaving(false)
    }
  }

  async function buscarDoMp() {
    setFetchingMp(true); setMpErr(null); setMpInfo(null)
    try {
      const res  = await fetch('/api/admin/mp-rates')
      const data = await res.json() as { rates: MpRates; source: string; account?: { id: number; email: string } }

      setPix(data.rates.pix)
      setDebito(data.rates.debito)
      setCred1x(data.rates.credito_1x)
      setCred6x(data.rates.credito_6x)
      setCred12x(data.rates.credito_12x)

      if (data.account) setMpInfo({ email: data.account.email, id: data.account.id })

      if (data.source === 'default') {
        setMpErr('O MP não expõe taxas individuais na API — carregadas as taxas padrão de mercado. Ajuste se necessário.')
      }
    } catch {
      setMpErr('Erro ao contactar o Mercado Pago')
    } finally {
      setFetchingMp(false)
    }
  }

  const feePct = props.platformFeePct

  return (
    <div className="flex flex-col gap-5">

      {/* Abas da página */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setAba('tarifas')}
          className={cn(
            'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
            aba === 'tarifas'
              ? 'bg-[#E8B84B10] border-[#E8B84B40] text-white'
              : 'bg-[#111] border-[#222] text-[#777] hover:border-[#2a2a2a]'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Tarifas
        </button>
        <button
          type="button"
          onClick={() => setAba('gateways')}
          className={cn(
            'px-4 py-2.5 rounded-xl text-sm font-medium border transition-all',
            aba === 'gateways'
              ? 'bg-[#E8B84B10] border-[#E8B84B40] text-white'
              : 'bg-[#111] border-[#222] text-[#777] hover:border-[#2a2a2a]'
          )}
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        >
          Gateways
        </button>
      </div>

      {/* Aba Gateways — credenciais da própria conta Tipo7 em cada gateway.
           Ponto único onde entram novos bancos conforme forem integrados. */}
      {aba === 'gateways' && (
        <div className="flex flex-col gap-4">
          {/* Input de arquivo compartilhado — pedirLogo() define qual gateway recebe o upload */}
          <input
            ref={logoInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) enviarLogo(f); e.target.value = '' }}
          />

          <div className="flex items-center gap-3">
            {([
              { id: 'mercadopago' as const, label: 'Mercado Pago', logo: logoMp,
                fallbackNode: <span className="text-[10px] font-bold tracking-widest" style={{ color: '#00A0DC' }}>MP</span> },
              { id: 'pagbank' as const,     label: 'PagBank',      logo: logoPagbank,
                fallbackNode: <Wallet size={22} style={{ color: '#00A868' }} /> },
            ]).map(({ id, label, logo, fallbackNode }) => (
              <div key={id} className="flex flex-col items-center gap-1.5">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setGatewayAberto(p => p === id ? null : id)}
                    className="flex items-center justify-center w-28 h-16 rounded-2xl border transition-all overflow-hidden"
                    style={{
                      background: '#0d0d0d',
                      border: `1px solid ${gatewayAberto === id ? '#E8B84B40' : '#1a1a1a'}`,
                    }}
                  >
                    {logo
                      // eslint-disable-next-line @next/next/no-img-element
                      ? <img src={logo} alt={label} className="w-full h-full object-contain p-2.5" />
                      : fallbackNode
                    }
                  </button>
                  <button
                    type="button"
                    onClick={() => pedirLogo(id)}
                    disabled={uploadingLogo === id}
                    title="Enviar logo"
                    className="absolute -top-1.5 -right-1.5 w-6 h-6 rounded-full flex items-center justify-center transition-all"
                    style={{ background: ACCENT, color: '#070707' }}
                  >
                    {uploadingLogo === id ? <Loader2 size={11} className="animate-spin" /> : <ImagePlus size={11} />}
                  </button>
                </div>
                <p className="text-[11px] font-medium" style={{ color: gatewayAberto === id ? ACCENT : '#666', fontFamily: 'var(--font-dm-sans)' }}>
                  {label}
                </p>
              </div>
            ))}
          </div>

          {/* Painel Mercado Pago — já validado, credenciais controlam o checkout ao vivo */}
          {gatewayAberto === 'mercadopago' && (
            <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
              <div className="flex items-start justify-between gap-3 mb-1">
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Credenciais Mercado Pago
                    </p>
                    <span className="flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full"
                          style={{ background: '#22c55e12', color: '#4ade80', fontFamily: 'var(--font-dm-sans)' }}>
                      <ShieldCheck size={9} /> Ativo
                    </span>
                  </div>
                  <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Conta própria da Tipo7 — usada como padrão do checkout e no fluxo de conexão OAuth dos promotores
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMostrarSegredos(v => !v)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all"
                  style={{ background: '#111', border: '1px solid #222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {mostrarSegredos ? <EyeOff size={12} /> : <Eye size={12} />}
                  {mostrarSegredos ? 'Ocultar' : 'Mostrar'}
                </button>
              </div>

              <div className="flex flex-col gap-3 mt-4">
                {([
                  { label: 'Access Token',   value: mpAccessToken,   set: setMpAccessToken,   secreto: true,  placeholder: 'APP_USR-...' },
                  { label: 'Public Key',     value: mpPublicKey,     set: setMpPublicKey,     secreto: false, placeholder: 'APP_USR-...' },
                  { label: 'Client ID',      value: mpClientId,      set: setMpClientId,      secreto: false, placeholder: '1234567890123456' },
                  { label: 'Client Secret',  value: mpClientSecret,  set: setMpClientSecret,  secreto: true,  placeholder: '' },
                  { label: 'Webhook Secret', value: mpWebhookSecret, set: setMpWebhookSecret, secreto: true,  placeholder: '' },
                ] as const).map(({ label, value, set, secreto, placeholder }) => (
                  <div key={label} className="flex flex-col gap-1">
                    <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      {label}
                    </label>
                    <input
                      type={secreto && !mostrarSegredos ? 'password' : 'text'}
                      value={value}
                      onChange={e => set(e.target.value)}
                      placeholder={placeholder}
                      autoComplete="off"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2.5 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#2e2e2e]"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  </div>
                ))}
              </div>

              <div className="flex justify-end mt-5">
                <button
                  type="button"
                  onClick={salvarCredenciaisMp}
                  disabled={credSaving}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
                  style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                >
                  {credSaving ? <Loader2 size={14} className="animate-spin" /> : credSaved ? <><Check size={14} /> Salvo!</> : 'Salvar credenciais'}
                </button>
              </div>
            </div>
          )}

          {/* Painel PagBank — ainda não integrado nessa tela */}
          {gatewayAberto === 'pagbank' && (
            <div className="rounded-2xl p-8 flex flex-col items-center justify-center gap-2 text-center"
                 style={{ background: '#0d0d0d', border: '1.5px dashed #1e1e1e' }}>
              <Wallet size={20} className="text-[#333] mb-1" />
              <p className="text-[#555] text-sm font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Credenciais do PagBank em breve
              </p>
              <p className="text-[#333] text-xs max-w-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Essa aba vai ganhar os mesmos campos assim que integrarmos o PagBank por aqui.
              </p>
            </div>
          )}
        </div>
      )}

      {aba === 'tarifas' && <>

      {/* Card: Taxa da Tipo7 */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <div className="flex items-center justify-between mb-1">
          <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            Taxa da plataforma
          </p>
          <span className="text-xs font-bold px-2.5 py-1 rounded-lg"
                style={{ background: `${ACCENT}18`, color: ACCENT, fontFamily: 'var(--font-syne)' }}>
            {feePct}%
          </span>
        </div>
        <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Definida em Financeiro → Tarifas. Aqui você escreve a descrição que o promotor vai ler.
        </p>
        <textarea
          rows={3}
          value={descPlat}
          onChange={e => setDescPlat(e.target.value)}
          placeholder="Ex: A Tipo7 cobra 10% sobre cada venda processada. Essa taxa cobre os custos operacionais da plataforma e o suporte ao promotor."
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#2e2e2e] resize-none"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
      </div>

      {/* Card: Taxas do Mercado Pago */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <div className="flex items-start justify-between gap-3 mb-1">
          <div>
            <p className="text-white text-sm font-semibold" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Taxas do Mercado Pago
            </p>
            <p className="text-[#444] text-xs mt-0.5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Valores por método de pagamento — editáveis manualmente
            </p>
          </div>
          <button
            type="button"
            onClick={buscarDoMp}
            disabled={fetchingMp}
            className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium shrink-0 transition-all disabled:opacity-60"
            style={{ background: '#111', border: '1px solid #222', color: '#888', fontFamily: 'var(--font-dm-sans)' }}
          >
            {fetchingMp ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Buscar do MP
          </button>
        </div>

        {mpInfo && (
          <div className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg mb-3 mt-3"
               style={{ background: '#22c55e10', border: '1px solid #22c55e25', color: '#4ade80', fontFamily: 'var(--font-dm-sans)' }}>
            <Check size={11} /> Conta MP: {mpInfo.email} (ID {mpInfo.id})
          </div>
        )}

        {mpErr && (
          <div className="flex items-start gap-2 text-xs px-3 py-2.5 rounded-lg mb-3 mt-3"
               style={{ background: '#E8B84B08', border: '1px solid #E8B84B20', color: '#888', fontFamily: 'var(--font-dm-sans)' }}>
            <Info size={11} className="mt-0.5 shrink-0" style={{ color: ACCENT }} />
            {mpErr}
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 mt-4">
          {[
            { label: 'Pix',                    value: pix,    set: setPix    },
            { label: 'Débito',                 value: debito, set: setDebito },
            { label: 'Crédito 1×',             value: cred1x, set: setCred1x },
            { label: 'Crédito 2–6×',           value: cred6x, set: setCred6x },
            { label: 'Crédito 7–12×',          value: cred12x,set: setCred12x },
          ].map(({ label, value, set }) => (
            <div key={label} className="flex items-center gap-3">
              <p className="text-[#555] text-xs w-28 shrink-0" style={{ fontFamily: 'var(--font-dm-sans)' }}>{label}</p>
              <div className="relative flex-1">
                <input
                  type="text"
                  value={value}
                  onChange={e => set(e.target.value)}
                  className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-2 text-white text-sm outline-none focus:border-[#E8B84B]/40 pr-8"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] text-xs">%</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Card: Nota extra */}
      <div className="rounded-2xl p-6" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>
        <p className="text-white text-sm font-semibold mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Observação adicional
        </p>
        <p className="text-[#444] text-xs mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Texto livre exibido no rodapé da seção de tarifas do promotor (opcional)
        </p>
        <textarea
          rows={2}
          value={notaExtra}
          onChange={e => setNotaExtra(e.target.value)}
          placeholder="Ex: As taxas do Mercado Pago variam conforme o volume mensal e o tipo de conta. Consulte mercadopago.com.br/taxas para mais detalhes."
          className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#2e2e2e] resize-none"
          style={{ fontFamily: 'var(--font-dm-sans)' }}
        />
      </div>

      {/* Preview */}
      <div className="rounded-2xl p-6" style={{ background: '#080808', border: '1.5px dashed #1e1e1e' }}>
        <p className="text-[#333] text-[10px] uppercase tracking-wider mb-4" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Preview — como o promotor vê
        </p>
        <div className="flex flex-col gap-3">
          <div className="flex justify-between items-center py-2 border-b border-[#111]">
            <p className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>Taxa Tipo7</p>
            <span className="text-white text-xs font-bold" style={{ fontFamily: 'var(--font-syne)' }}>{feePct}%</span>
          </div>
          {[
            { m: 'Pix',         v: pix    },
            { m: 'Débito',      v: debito },
            { m: 'Crédito 1×',  v: cred1x },
            { m: 'Crédito 2-6×',v: cred6x },
            { m: 'Crédito 7-12×',v: cred12x },
          ].map(({ m, v }) => (
            <div key={m} className="flex justify-between items-center py-1">
              <p className="text-[#444] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>MP · {m}</p>
              <span className="text-[#666] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{v}%</span>
            </div>
          ))}
          {descPlat && (
            <p className="text-[#333] text-[11px] mt-2 leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              {descPlat}
            </p>
          )}
          {notaExtra && (
            <div className="flex items-start gap-2 mt-1">
              <AlertTriangle size={10} className="text-[#2e2e2e] mt-0.5 shrink-0" />
              <p className="text-[#2e2e2e] text-[10px] leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                {notaExtra}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Salvar */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={salvarTudo}
          disabled={saving}
          className="flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold text-[#070707] disabled:opacity-60"
          style={{ background: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <><Check size={14} /> Salvo!</> : 'Salvar tudo'}
        </button>
      </div>

      </>}

    </div>
  )
}
