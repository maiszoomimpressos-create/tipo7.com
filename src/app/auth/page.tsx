'use client'

// Página de autenticação — Login e Cadastro
// Dois modos alternáveis por abas: Entrar / Criar conta
// Conectada ao Supabase via AuthContext
import { useState, useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  Ticket, Eye, EyeOff, ArrowLeft,
  Loader2, AlertCircle, Mail
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { createClient } from '@/lib/supabase/client'

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: Record<string, unknown>) => void
          prompt:     (cb?: (n: { isNotDisplayed: () => boolean; isSkippedMoment: () => boolean }) => void) => void
        }
      }
    }
  }
}

type Tab = 'entrar' | 'cadastrar'

interface FieldState { touched: boolean; error: string | null }

// Valida email básico
const isValidEmail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)

// Formata telefone: (11) 99999-9999
const formatPhone = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 2)  return d.length ? `(${d}` : ''
  if (d.length <= 7)  return `(${d.slice(0,2)}) ${d.slice(2)}`
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`
}

// Formata CPF: 123.456.789-00
const formatCPF = (v: string) => {
  const d = v.replace(/\D/g, '').slice(0, 11)
  if (d.length <= 3)  return d
  if (d.length <= 6)  return `${d.slice(0,3)}.${d.slice(3)}`
  if (d.length <= 9)  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`
}

// Valida CPF pelo algoritmo oficial
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

const formatBirthDate = (raw: string) => {
  const d = raw.replace(/\D/g, '').slice(0, 8)
  if (d.length <= 2) return d
  if (d.length <= 4) return `${d.slice(0, 2)}/${d.slice(2)}`
  return `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}`
}

const displayToISO = (display: string) => {
  const parts = display.split('/')
  if (parts.length !== 3 || parts[2].length < 4) return ''
  return `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`
}

// Valida se tem pelo menos 13 anos (para restrição de idade) — aceita DD/MM/AAAA
const isValidBirthDate = (v: string) => {
  if (!v) return true
  const iso = displayToISO(v)
  if (!iso) return false
  const birth = new Date(iso)
  const age = (Date.now() - birth.getTime()) / (1000 * 60 * 60 * 24 * 365.25)
  return age >= 13
}

// Requisitos de senha — cada um retorna true/false individualmente
const pwdRules = {
  length:  (v: string) => v.length >= 8,
  upper:   (v: string) => /[A-Z]/.test(v),
  lower:   (v: string) => /[a-z]/.test(v),
  number:  (v: string) => /[0-9]/.test(v),
  special: (v: string) => /[^A-Za-z0-9]/.test(v),
}
const isStrongPassword = (v: string) => Object.values(pwdRules).every(fn => fn(v))

export default function AuthPage() {
  const { signIn, signUp, signInWithSocial } = useAuth()
  const supabase = createClient()
  const router   = useRouter()
  const gsiReady = useRef(false)
  const [tab, setTab] = useState<Tab>('entrar')

  // ── Estados do formulário de login ──────────────────────────
  const [loginEmail,    setLoginEmail]    = useState('')
  const [loginPassword, setLoginPassword] = useState('')
  const [showLoginPwd,  setShowLoginPwd]  = useState(false)
  const [loginLoading,  setLoginLoading]  = useState(false)
  const [loginError,    setLoginError]    = useState<string | null>(null)
  const [socialLoading, setSocialLoading] = useState<'google' | 'facebook' | null>(null)

  // ── Estados do formulário de cadastro ───────────────────────
  const [regName,       setRegName]       = useState('')
  const [regEmail,      setRegEmail]      = useState('')
  const [regPassword,   setRegPassword]   = useState('')
  const [regConfirm,    setRegConfirm]    = useState('')
  const [regPhone,      setRegPhone]      = useState('')
  const [regCPF,        setRegCPF]        = useState('')
  const [regBirthDate,  setRegBirthDate]  = useState('')
  const [showRegPwd,    setShowRegPwd]    = useState(false)
  const [showRegConf,   setShowRegConf]   = useState(false)
  const [regLoading,    setRegLoading]    = useState(false)
  const [regError,      setRegError]      = useState<string | null>(null)
  const [regSuccess,    setRegSuccess]    = useState(false)
  const [termosAceitos, setTermosAceitos] = useState(false)

  // ── Validações em tempo real no cadastro ────────────────────
  const [fields, setFields] = useState<Record<string, FieldState>>({
    regName:      { touched: false, error: null },
    regEmail:     { touched: false, error: null },
    regPassword:  { touched: false, error: null },
    regConfirm:   { touched: false, error: null },
    regPhone:     { touched: false, error: null },
    regCPF:       { touched: false, error: null },
    regBirthDate: { touched: false, error: null },
  })

  const touch = (field: string, value: string) => {
    let error: string | null = null
    if (field === 'regName'      && value.trim().length < 3)   error = 'Nome muito curto'
    if (field === 'regEmail'     && !isValidEmail(value))      error = 'Email inválido'
    if (field === 'regPassword'  && !isStrongPassword(value))  error = 'A senha não atende todos os requisitos'
    if (field === 'regConfirm'   && value !== regPassword)     error = 'Senhas não coincidem'
    if (field === 'regPhone'     && value.replace(/\D/g,'').length < 10) error = 'Telefone obrigatório'
    if (field === 'regCPF'       && !isValidCPF(value))                 error = !value ? 'CPF obrigatório' : 'CPF inválido'
    if (field === 'regBirthDate' && !value)                             error = 'Data de nascimento obrigatória'
    if (field === 'regBirthDate' && value && !isValidBirthDate(value))  error = 'Idade mínima: 13 anos'
    setFields(f => ({ ...f, [field]: { touched: true, error } }))
  }

  // Carrega o script do Google Identity Services uma vez
  useEffect(() => {
    if (gsiReady.current) return
    const script = document.createElement('script')
    script.src   = 'https://accounts.google.com/gsi/client'
    script.async = true
    script.onload = () => { gsiReady.current = true }
    document.head.appendChild(script)
    return () => { if (document.head.contains(script)) document.head.removeChild(script) }
  }, [])

  // Login com Google via Google Identity Services (One Tap)
  // Mostra tipo7.com na tela de permissão do Google, não supabase.co
  const handleGoogleLogin = async () => {
    setSocialLoading('google')
    setLoginError(null)
    setRegError(null)
    try {
      if (!window.google?.accounts?.id) {
        // GSI ainda não carregou — usa rota própria (mostra tipo7.com no Google)
        const next = new URLSearchParams(window.location.search).get('next') ?? '/'
        window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`
        return
      }

      // Nonce: gera raw → passa hash para o Google → passa raw para o Supabase
      const rawNonce    = btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32))))
      const encoded     = new TextEncoder().encode(rawNonce)
      const hashBuffer  = await crypto.subtle.digest('SHA-256', encoded)
      const hashedNonce = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('')

      window.google.accounts.id.initialize({
        client_id: '140800251762-77n3v5pogj8ipsktbdo06cfhd6aok84h.apps.googleusercontent.com',
        nonce:     hashedNonce,
        callback:  async ({ credential }: { credential: string }) => {
          const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce: rawNonce }).then(r => ({ error: r.error?.message ?? null }))
          if (error) {
            setLoginError('Não foi possível autenticar com Google. Tente novamente.')
            setSocialLoading(null)
          } else {
            const next = new URLSearchParams(window.location.search).get('next') ?? '/'
            router.push(next)
          }
        },
      })

      window.google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          // One Tap não abriu — usa rota própria (mostra tipo7.com no Google)
          const next = new URLSearchParams(window.location.search).get('next') ?? '/'
          window.location.href = `/api/auth/google?next=${encodeURIComponent(next)}`
        }
      })
    } catch {
      setLoginError('Erro ao carregar Google. Tente novamente.')
      setSocialLoading(null)
    }
  }

  // ── Submit: Login Social ────────────────────────────────────
  const handleSocialLogin = async (provider: 'google' | 'facebook') => {
    setSocialLoading(provider)
    setLoginError(null)
    setRegError(null)
    const { error } = await signInWithSocial(provider)
    if (error) {
      setLoginError(error)
      setSocialLoading(null)
    }
    // Se sucesso, o Supabase redireciona automaticamente — não limpar o loading
  }

  // ── Submit: Login ───────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoginLoading(true)
    setLoginError(null)
    try {
      const { error } = await signIn(loginEmail, loginPassword)
      if (error) {
        setLoginError(error)
        return
      }
      router.push('/')
    } finally {
      setLoginLoading(false)
    }
  }

  // ── Submit: Cadastro ────────────────────────────────────────
  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault()
    // Valida campos obrigatórios
    if (!regPhone || regPhone.replace(/\D/g,'').length < 10) { setRegError('Telefone é obrigatório.'); return }
    if (!isValidCPF(regCPF))                                  { setRegError('CPF inválido ou não preenchido.'); return }
    if (!regBirthDate)                                        { setRegError('Data de nascimento é obrigatória.'); return }
    if (!isStrongPassword(regPassword))                       { setRegError('A senha não atende todos os requisitos de segurança.'); return }
    if (regPassword !== regConfirm)                           { setRegError('As senhas não coincidem.'); return }
    if (!termosAceitos)                                       { setRegError('Você precisa aceitar os Termos de Uso para continuar.'); return }
    setRegLoading(true)
    setRegError(null)
    try {
      // Verifica CPF duplicado antes de tentar criar conta
      const cpfNumeros = regCPF.replace(/\D/g, '')
      const cpfCheck = await fetch(`/api/check-cpf?cpf=${cpfNumeros}`).then(r => r.json()) as { exists: boolean }
      if (cpfCheck.exists) {
        setRegError('Este CPF já está cadastrado. Se você já tem conta, faça login com o e-mail que usou no cadastro.')
        setRegLoading(false)
        return
      }

      // Verifica telefone duplicado
      const phoneNumeros = regPhone.replace(/\D/g, '')
      const phoneCheck = await fetch(`/api/check-phone?phone=${phoneNumeros}`).then(r => r.json()) as { exists: boolean }
      if (phoneCheck.exists) {
        setRegError('Este telefone já está cadastrado. Se você já tem conta, faça login com o e-mail que usou no cadastro.')
        setRegLoading(false)
        return
      }

      const { error } = await signUp({
        name:      regName,
        email:     regEmail,
        password:  regPassword,
        phone:     regPhone,
        cpf:       regCPF,
        birthDate: displayToISO(regBirthDate),
      })
      if (error) {
        // Supabase às vezes retorna '{}' ou '[]' quando o erro é interno/trigger
        const useful = typeof error === 'string' && error.length > 3
          && !error.trim().startsWith('{') && !error.trim().startsWith('[')
        setRegError(useful ? error : 'Erro ao criar conta. Verifique os dados ou tente com outro e-mail.')
        return
      }
      setRegSuccess(true)
    } catch {
      setRegError('Erro ao criar conta. Verifique sua conexão e tente novamente.')
    } finally {
      setRegLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex items-center justify-center relative overflow-hidden px-4 py-12">

      {/* ── Elementos decorativos de fundo ────────────────────── */}

      {/* Grade de linhas finas */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `
            linear-gradient(#E8B84B 1px, transparent 1px),
            linear-gradient(90deg, #E8B84B 1px, transparent 1px)
          `,
          backgroundSize: '64px 64px',
        }}
      />

      {/* Orb dourado superior esquerdo */}
      <div
        className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      {/* Orb dourado inferior direito */}
      <div
        className="absolute -bottom-48 -right-32 w-[400px] h-[400px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.08) 0%, transparent 70%)', filter: 'blur(60px)' }}
      />

      {/* Linha diagonal decorativa */}
      <div
        className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-5"
        style={{ background: 'linear-gradient(135deg, #E8B84B 0%, transparent 40%)' }}
      />

      {/* ── Card de autenticação ───────────────────────────────── */}
      <div className="relative w-full max-w-[420px]">

        {/* Brilho na borda do card */}
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(232,184,75,0.3), transparent 50%, rgba(232,184,75,0.1))', filter: 'blur(0.5px)' }}
        />

        <div className="relative bg-[#0d0d0d] rounded-2xl border border-[#1c1c1c] overflow-hidden">

          {/* Linha dourada no topo do card */}
          <div
            className="h-[2px] w-full"
            style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }}
          />

          <div className="p-8">

            {/* Logo */}
            <div className="flex justify-center mb-8">
              <a href="/" className="flex items-center gap-2.5 group select-none">
                <div className="relative">
                  <Ticket
                    size={22}
                    className="text-[#E8B84B] transition-transform duration-300 group-hover:rotate-12"
                    strokeWidth={2}
                  />
                  <div className="absolute inset-0 bg-[#E8B84B]/20 blur-md scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                </div>
                <span className="text-[17px] tracking-tight" style={{ fontFamily: 'var(--font-syne)', fontWeight: 800 }}>
                  <span className="text-white">tipo</span>
                  <span className="text-[#E8B84B]">7</span>
                </span>
              </a>
            </div>

            {/* Abas */}
            <div className="flex bg-[#070707] rounded-xl p-1 mb-7 border border-[#1a1a1a]">
              {(['entrar', 'cadastrar'] as Tab[]).map(t => (
                <button
                  key={t}
                  onClick={() => { setTab(t); setLoginError(null); setRegError(null) }}
                  className={cn(
                    'flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200',
                    tab === t
                      ? 'text-[#070707]'
                      : 'text-[#555] hover:text-[#888]'
                  )}
                  style={{
                    background:  tab === t ? '#E8B84B' : 'transparent',
                    fontFamily:  'var(--font-dm-sans)',
                  }}
                >
                  {t === 'entrar' ? 'Entrar' : 'Criar conta'}
                </button>
              ))}
            </div>

            {/* ── BOTÕES SOCIAIS (ambas as abas) ─────────────── */}
            <div className="flex flex-col gap-3 mb-6">
              {/* Google */}
              <button
                type="button"
                onClick={handleGoogleLogin}
                disabled={!!socialLoading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[#2a2a2a] bg-[#111] hover:bg-[#161616] hover:border-[#333] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {socialLoading === 'google'
                  ? <Loader2 size={18} className="animate-spin text-[#666]" />
                  : (
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                      <path d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" fill="#4285F4"/>
                      <path d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.909-2.259c-.806.54-1.837.86-3.047.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z" fill="#34A853"/>
                      <path d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" fill="#FBBC05"/>
                      <path d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z" fill="#EA4335"/>
                    </svg>
                  )
                }
                <span className="text-[#ccc] text-sm font-medium">Continuar com Google</span>
              </button>

              {/* Facebook */}
              <button
                type="button"
                onClick={() => handleSocialLogin('facebook')}
                disabled={!!socialLoading}
                className="w-full flex items-center justify-center gap-3 py-3 rounded-xl border border-[#2a2a2a] bg-[#111] hover:bg-[#161616] hover:border-[#333] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                {socialLoading === 'facebook'
                  ? <Loader2 size={18} className="animate-spin text-[#666]" />
                  : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="#1877F2">
                      <path d="M24 12.073C24 5.404 18.627 0 12 0S0 5.404 0 12.073C0 18.1 4.388 23.094 10.125 24v-8.437H7.078v-3.49h3.047V9.41c0-3.025 1.792-4.697 4.533-4.697 1.312 0 2.686.236 2.686.236v2.97h-1.513c-1.491 0-1.956.93-1.956 1.886v2.267h3.328l-.532 3.49h-2.796V24C19.612 23.094 24 18.1 24 12.073z"/>
                    </svg>
                  )
                }
                <span className="text-[#ccc] text-sm font-medium">Continuar com Facebook</span>
              </button>
            </div>

            {/* Divisor "ou" */}
            <div className="flex items-center gap-3 mb-6">
              <div className="flex-1 h-px bg-[#1e1e1e]" />
              <span className="text-[#333] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>ou</span>
              <div className="flex-1 h-px bg-[#1e1e1e]" />
            </div>

            {/* ── FORMULÁRIO: ENTRAR ──────────────────────────── */}
            {tab === 'entrar' && (
              <form onSubmit={handleLogin} className="flex flex-col gap-4" noValidate>

                {/* Campo email */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[#666] text-[11px] font-medium tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Email
                  </label>
                  <input
                    type="email"
                    value={loginEmail}
                    onChange={e => setLoginEmail(e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                </div>

                {/* Campo senha */}
                <div className="flex flex-col gap-1.5">
                  <label
                    className="text-[#666] text-[11px] font-medium tracking-widest uppercase"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showLoginPwd ? 'text' : 'password'}
                      value={loginPassword}
                      onChange={e => setLoginPassword(e.target.value)}
                      placeholder="••••••••"
                      required
                      autoComplete="current-password"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                    <button
                      type="button"
                      onClick={() => setShowLoginPwd(v => !v)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors"
                      tabIndex={-1}
                    >
                      {showLoginPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                </div>

                {/* Erro de login */}
                {loginError && (
                  <div
                    className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    <AlertCircle size={14} className="shrink-0" />
                    {loginError}
                  </div>
                )}

                {/* Botão entrar */}
                <button
                  type="submit"
                  disabled={loginLoading}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {loginLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Entrando...</>
                    : 'Entrar'
                  }
                </button>

                {/* Esqueci a senha */}
                <a
                  href="/auth/recuperar"
                  className="text-center text-[#444] text-xs hover:text-[#777] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Esqueci minha senha
                </a>

              </form>
            )}

            {/* ── FORMULÁRIO: CRIAR CONTA ─────────────────────── */}
            {tab === 'cadastrar' && !regSuccess && (
              <form onSubmit={handleRegister} className="flex flex-col gap-4" noValidate>

                {/* Nome completo */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Nome completo
                  </label>
                  <input
                    type="text"
                    value={regName}
                    onChange={e => setRegName(e.target.value)}
                    onBlur={e => touch('regName', e.target.value)}
                    placeholder="Seu nome"
                    required
                    autoComplete="name"
                    className={cn(
                      'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                      fields.regName.touched && fields.regName.error
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : fields.regName.touched && !fields.regName.error
                        ? 'border-green-500/30 focus:border-green-500/50'
                        : 'border-[#222] focus:border-[#E8B84B]/40'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {fields.regName.touched && fields.regName.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regName.error}</p>
                  )}
                </div>

                {/* Email */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={regEmail}
                    onChange={e => setRegEmail(e.target.value)}
                    onBlur={e => touch('regEmail', e.target.value)}
                    placeholder="seu@email.com"
                    required
                    autoComplete="email"
                    className={cn(
                      'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                      fields.regEmail.touched && fields.regEmail.error
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : fields.regEmail.touched && !fields.regEmail.error
                        ? 'border-green-500/30 focus:border-green-500/50'
                        : 'border-[#222] focus:border-[#E8B84B]/40'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {fields.regEmail.touched && fields.regEmail.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regEmail.error}</p>
                  )}
                </div>

                {/* Telefone — obrigatório */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Telefone
                  </label>
                  <input
                    type="tel"
                    value={regPhone}
                    onChange={e => setRegPhone(formatPhone(e.target.value))}
                    onBlur={e => touch('regPhone', e.target.value)}
                    placeholder="(00) 00000-0000"
                    autoComplete="tel"
                    className={cn(
                      'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                      fields.regPhone.touched && fields.regPhone.error
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : fields.regPhone.touched && !fields.regPhone.error && regPhone
                        ? 'border-green-500/30 focus:border-green-500/50'
                        : 'border-[#222] focus:border-[#E8B84B]/40'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {fields.regPhone.touched && fields.regPhone.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regPhone.error}</p>
                  )}
                </div>

                {/* CPF — obrigatório */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    CPF
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={regCPF}
                    onChange={e => setRegCPF(formatCPF(e.target.value))}
                    onBlur={e => touch('regCPF', e.target.value)}
                    placeholder="000.000.000-00"
                    autoComplete="off"
                    className={cn(
                      'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                      fields.regCPF.touched && fields.regCPF.error
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : fields.regCPF.touched && !fields.regCPF.error && regCPF
                        ? 'border-green-500/30 focus:border-green-500/50'
                        : 'border-[#222] focus:border-[#E8B84B]/40'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {fields.regCPF.touched && fields.regCPF.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regCPF.error}</p>
                  )}
                </div>

                {/* Data de nascimento — obrigatório */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Data de nascimento
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={regBirthDate}
                    onChange={e => setRegBirthDate(formatBirthDate(e.target.value))}
                    onBlur={e => touch('regBirthDate', e.target.value)}
                    placeholder="DD/MM/AAAA"
                    maxLength={10}
                    className={cn(
                      'w-full bg-[#111] border rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                      fields.regBirthDate.touched && fields.regBirthDate.error
                        ? 'border-red-500/50 focus:border-red-500/70'
                        : fields.regBirthDate.touched && !fields.regBirthDate.error && regBirthDate
                        ? 'border-green-500/30 focus:border-green-500/50'
                        : 'border-[#222] focus:border-[#E8B84B]/40'
                    )}
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  />
                  {fields.regBirthDate.touched && fields.regBirthDate.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regBirthDate.error}</p>
                  )}
                </div>

                {/* Senha */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Senha
                  </label>
                  <div className="relative">
                    <input
                      type={showRegPwd ? 'text' : 'password'}
                      value={regPassword}
                      onChange={e => { setRegPassword(e.target.value); touch('regPassword', e.target.value) }}
                      onBlur={e => touch('regPassword', e.target.value)}
                      placeholder="Crie uma senha forte"
                      required
                      autoComplete="new-password"
                      className={cn(
                        'w-full bg-[#111] border rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                        regPassword && isStrongPassword(regPassword)
                          ? 'border-green-500/30 focus:border-green-500/50'
                          : regPassword
                          ? 'border-[#E8B84B]/30 focus:border-[#E8B84B]/50'
                          : 'border-[#222] focus:border-[#E8B84B]/40'
                      )}
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                    <button type="button" onClick={() => setShowRegPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors" tabIndex={-1}>
                      {showRegPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>

                  {/* Indicador visual dos requisitos — aparece enquanto o usuário digita */}
                  {regPassword && (
                    <div className="grid grid-cols-2 gap-1.5 mt-1">
                      {[
                        { key: 'length',  label: 'Mínimo 8 caracteres' },
                        { key: 'upper',   label: 'Letra maiúscula' },
                        { key: 'lower',   label: 'Letra minúscula' },
                        { key: 'number',  label: 'Número' },
                        { key: 'special', label: 'Caractere especial' },
                      ].map(({ key, label }) => {
                        const ok = pwdRules[key as keyof typeof pwdRules](regPassword)
                        return (
                          <div key={key} className="flex items-center gap-1.5">
                            <div className={cn(
                              'w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200',
                              ok ? 'bg-green-500' : 'bg-[#333]'
                            )} />
                            <span
                              className={cn('text-[11px] transition-colors duration-200', ok ? 'text-green-500' : 'text-[#444]')}
                              style={{ fontFamily: 'var(--font-dm-sans)' }}
                            >
                              {label}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>

                {/* Confirmar senha */}
                <div className="flex flex-col gap-1.5">
                  <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Confirmar senha
                  </label>
                  <div className="relative">
                    <input
                      type={showRegConf ? 'text' : 'password'}
                      value={regConfirm}
                      onChange={e => setRegConfirm(e.target.value)}
                      onBlur={e => touch('regConfirm', e.target.value)}
                      placeholder="Repita a senha"
                      required
                      autoComplete="new-password"
                      className={cn(
                        'w-full bg-[#111] border rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-all duration-200 focus:bg-[#131313] placeholder:text-[#383838]',
                        fields.regConfirm.touched && fields.regConfirm.error
                          ? 'border-red-500/50'
                          : fields.regConfirm.touched && !fields.regConfirm.error
                          ? 'border-green-500/30'
                          : 'border-[#222] focus:border-[#E8B84B]/40'
                      )}
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                    <button type="button" onClick={() => setShowRegConf(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors" tabIndex={-1}>
                      {showRegConf ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  {fields.regConfirm.touched && fields.regConfirm.error && (
                    <p className="text-red-400 text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>{fields.regConfirm.error}</p>
                  )}
                </div>

                {/* Aceite dos Termos de Uso */}
                <label className="flex items-start gap-3 cursor-pointer group">
                  {/* Checkbox customizado */}
                  <div className="relative mt-0.5 shrink-0">
                    <input
                      type="checkbox"
                      checked={termosAceitos}
                      onChange={e => { setTermosAceitos(e.target.checked); if (regError) setRegError(null) }}
                      className="sr-only"
                    />
                    <div
                      className="w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200"
                      style={{
                        background:   termosAceitos ? '#E8B84B' : 'transparent',
                        borderColor:  termosAceitos ? '#E8B84B' : '#333',
                      }}
                    >
                      {termosAceitos && (
                        <svg width="11" height="9" viewBox="0 0 11 9" fill="none">
                          <path d="M1 4L4 7.5L10 1" stroke="#070707" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </div>
                  </div>
                  <span
                    className="text-xs leading-relaxed"
                    style={{ color: '#666', fontFamily: 'var(--font-dm-sans)' }}>
                    Li e concordo com os{' '}
                    <a
                      href="/termos"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="transition-colors hover:underline"
                      style={{ color: '#E8B84B' }}>
                      Termos de Uso
                    </a>
                    {' '}e a{' '}
                    <a
                      href="/privacidade"
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={e => e.stopPropagation()}
                      className="transition-colors hover:underline"
                      style={{ color: '#E8B84B' }}>
                      Política de Privacidade
                    </a>
                    {' '}da plataforma.
                  </span>
                </label>

                {/* Erro geral */}
                {regError && (
                  <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    <AlertCircle size={14} className="shrink-0" />
                    {regError}
                  </div>
                )}

                {/* Botão criar conta */}
                <button
                  type="submit"
                  disabled={regLoading || !termosAceitos}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-1"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                >
                  {regLoading
                    ? <><Loader2 size={15} className="animate-spin" /> Criando conta...</>
                    : 'Criar conta'
                  }
                </button>

              </form>
            )}

            {/* ── SUCESSO: EMAIL ENVIADO ──────────────────────── */}
            {tab === 'cadastrar' && regSuccess && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.25)' }}
                >
                  <Mail size={28} className="text-[#E8B84B]" />
                </div>
                <div>
                  <h3
                    className="text-white text-lg mb-1"
                    style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}
                  >
                    Verifique seu email
                  </h3>
                  <p
                    className="text-[#666] text-sm leading-relaxed"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    Enviamos um link de confirmação para<br />
                    <span className="text-[#999]">{regEmail}</span>.<br />
                    Clique no link para ativar sua conta.
                  </p>
                </div>
                <button
                  onClick={() => { setRegSuccess(false); setTab('entrar') }}
                  className="text-[#E8B84B] text-sm hover:text-[#F0C96A] transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Já confirmei — ir para o login
                </button>
              </div>
            )}

            {/* Link voltar */}
            <div className="mt-7 pt-6 border-t border-[#141414] text-center">
              <a
                href="/"
                className="inline-flex items-center gap-1.5 text-[#3a3a3a] text-xs hover:text-[#666] transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                <ArrowLeft size={12} />
                Voltar para o início
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
