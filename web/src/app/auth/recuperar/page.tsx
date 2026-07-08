'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Ticket, Loader2, AlertCircle, Mail, ArrowLeft, Eye, EyeOff, CheckCircle } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

const pwdRules = {
  length:  (v: string) => v.length >= 8,
  upper:   (v: string) => /[A-Z]/.test(v),
  lower:   (v: string) => /[a-z]/.test(v),
  number:  (v: string) => /[0-9]/.test(v),
  special: (v: string) => /[^A-Za-z0-9]/.test(v),
}
const isStrongPassword = (v: string) => Object.values(pwdRules).every(fn => fn(v))

export default function RecuperarPage() {
  const router  = useRouter()
  const supabase = createClient()

  // Detecta se o usuário chegou via link de recuperação (tem sessão ativa)
  const [mode, setMode]       = useState<'request' | 'reset' | 'done'>('request')
  const [checking, setChecking] = useState(true)

  // Estado: solicitar email
  const [email, setEmail]         = useState('')
  const [reqLoading, setReqLoading] = useState(false)
  const [reqError, setReqError]   = useState<string | null>(null)
  const [reqSent, setReqSent]     = useState(false)

  // Estado: nova senha
  const [password, setPassword]     = useState('')
  const [confirm, setConfirm]       = useState('')
  const [showPwd, setShowPwd]       = useState(false)
  const [showConf, setShowConf]     = useState(false)
  const [resetLoading, setResetLoading] = useState(false)
  const [resetError, setResetError] = useState<string | null>(null)

  useEffect(() => {
    // Verifica se tem sessão ativa — se sim, o usuário chegou pelo link de recuperação
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) {
        setMode('reset')
      }
      setChecking(false)
    })

    // Escuta evento de recuperação de senha do Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        setMode('reset')
        setChecking(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    setReqLoading(true)
    setReqError(null)
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback?next=/auth/recuperar`,
    })
    setReqLoading(false)
    if (error) {
      setReqError('Não foi possível enviar o email. Verifique o endereço e tente novamente.')
      return
    }
    setReqSent(true)
  }

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!isStrongPassword(password)) { setResetError('A senha não atende todos os requisitos.'); return }
    if (password !== confirm)        { setResetError('As senhas não coincidem.'); return }
    setResetLoading(true)
    setResetError(null)
    const { error } = await supabase.auth.updateUser({ password })
    setResetLoading(false)
    if (error) {
      setResetError('Erro ao atualizar a senha. Tente solicitar um novo link de recuperação.')
      return
    }
    setMode('done')
  }

  if (checking) {
    return (
      <div className="min-h-dvh bg-[#070707] flex items-center justify-center">
        <Loader2 size={24} className="animate-spin text-[#E8B84B]" />
      </div>
    )
  }

  return (
    <div className="min-h-dvh bg-[#070707] flex items-center justify-center relative overflow-hidden px-4 py-12">

      {/* Fundo decorativo */}
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `linear-gradient(#E8B84B 1px, transparent 1px), linear-gradient(90deg, #E8B84B 1px, transparent 1px)`,
          backgroundSize: '64px 64px',
        }}
      />
      <div
        className="absolute -top-48 -left-48 w-[500px] h-[500px] rounded-full pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(232,184,75,0.12) 0%, transparent 70%)', filter: 'blur(40px)' }}
      />

      <div className="relative w-full max-w-[420px]">
        <div
          className="absolute -inset-px rounded-2xl pointer-events-none"
          style={{ background: 'linear-gradient(135deg, rgba(232,184,75,0.3), transparent 50%, rgba(232,184,75,0.1))', filter: 'blur(0.5px)' }}
        />

        <div className="relative bg-[#0d0d0d] rounded-2xl border border-[#1c1c1c] overflow-hidden">
          <div className="h-[2px] w-full" style={{ background: 'linear-gradient(90deg, transparent, #E8B84B, transparent)' }} />

          <div className="p-8">

            {/* Logo */}
            <div className="flex justify-center mb-8">
              <a href="/" className="flex items-center gap-2.5 group select-none">
                <div className="relative">
                  <Ticket size={22} className="text-[#E8B84B] transition-transform duration-300 group-hover:rotate-12" strokeWidth={2} />
                </div>
                <span className="text-[17px] tracking-tight" style={{ fontFamily: 'var(--font-syne)', fontWeight: 800 }}>
                  <span className="text-white">tipo</span>
                  <span className="text-[#E8B84B]">7</span>
                </span>
              </a>
            </div>

            {/* ── SOLICITAR RESET ── */}
            {mode === 'request' && !reqSent && (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-white text-xl mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
                    Recuperar senha
                  </h1>
                  <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Informe seu email e enviaremos um link para redefinir sua senha.
                  </p>
                </div>

                <form onSubmit={handleRequest} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Email
                    </label>
                    <input
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      placeholder="seu@email.com"
                      required
                      autoComplete="email"
                      className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                      style={{ fontFamily: 'var(--font-dm-sans)' }}
                    />
                  </div>

                  {reqError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <AlertCircle size={14} className="shrink-0" />
                      {reqError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={reqLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                    style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {reqLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Enviando...</>
                      : 'Enviar link de recuperação'
                    }
                  </button>
                </form>
              </>
            )}

            {/* ── EMAIL ENVIADO ── */}
            {mode === 'request' && reqSent && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(232,184,75,0.12)', border: '1px solid rgba(232,184,75,0.25)' }}
                >
                  <Mail size={28} className="text-[#E8B84B]" />
                </div>
                <div>
                  <h3 className="text-white text-lg mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
                    Email enviado!
                  </h3>
                  <p className="text-[#666] text-sm leading-relaxed" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Enviamos um link para <span className="text-[#999]">{email}</span>.<br />
                    Clique no link para redefinir sua senha.
                  </p>
                </div>
              </div>
            )}

            {/* ── NOVA SENHA ── */}
            {mode === 'reset' && (
              <>
                <div className="mb-6 text-center">
                  <h1 className="text-white text-xl mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
                    Nova senha
                  </h1>
                  <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Escolha uma senha forte para sua conta.
                  </p>
                </div>

                <form onSubmit={handleReset} className="flex flex-col gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Nova senha
                    </label>
                    <div className="relative">
                      <input
                        type={showPwd ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        placeholder="Crie uma senha forte"
                        required
                        autoComplete="new-password"
                        className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      />
                      <button type="button" onClick={() => setShowPwd(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors" tabIndex={-1}>
                        {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>

                    {password && (
                      <div className="grid grid-cols-2 gap-1.5 mt-1">
                        {[
                          { key: 'length',  label: 'Mínimo 8 caracteres' },
                          { key: 'upper',   label: 'Letra maiúscula' },
                          { key: 'lower',   label: 'Letra minúscula' },
                          { key: 'number',  label: 'Número' },
                          { key: 'special', label: 'Caractere especial' },
                        ].map(({ key, label }) => {
                          const ok = pwdRules[key as keyof typeof pwdRules](password)
                          return (
                            <div key={key} className="flex items-center gap-1.5">
                              <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors duration-200 ${ok ? 'bg-green-500' : 'bg-[#333]'}`} />
                              <span className={`text-[11px] transition-colors duration-200 ${ok ? 'text-green-500' : 'text-[#444]'}`} style={{ fontFamily: 'var(--font-dm-sans)' }}>
                                {label}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1.5">
                    <label className="text-[#666] text-[11px] font-medium tracking-widest uppercase" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      Confirmar senha
                    </label>
                    <div className="relative">
                      <input
                        type={showConf ? 'text' : 'password'}
                        value={confirm}
                        onChange={e => setConfirm(e.target.value)}
                        placeholder="Repita a senha"
                        required
                        autoComplete="new-password"
                        className="w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 pr-11 text-white text-sm outline-none transition-all duration-200 focus:border-[#E8B84B]/40 focus:bg-[#131313] placeholder:text-[#383838]"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      />
                      <button type="button" onClick={() => setShowConf(v => !v)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888] transition-colors" tabIndex={-1}>
                        {showConf ? <EyeOff size={15} /> : <Eye size={15} />}
                      </button>
                    </div>
                  </div>

                  {resetError && (
                    <div className="flex items-center gap-2 text-red-400 text-sm bg-red-400/8 border border-red-400/15 rounded-xl px-4 py-3" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                      <AlertCircle size={14} className="shrink-0" />
                      {resetError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resetLoading}
                    className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110 disabled:opacity-60 flex items-center justify-center gap-2 mt-1"
                    style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {resetLoading
                      ? <><Loader2 size={15} className="animate-spin" /> Salvando...</>
                      : 'Salvar nova senha'
                    }
                  </button>
                </form>
              </>
            )}

            {/* ── SENHA ATUALIZADA ── */}
            {mode === 'done' && (
              <div className="flex flex-col items-center gap-4 py-4 text-center">
                <div
                  className="w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: 'rgba(34,197,94,0.12)', border: '1px solid rgba(34,197,94,0.25)' }}
                >
                  <CheckCircle size={28} className="text-green-500" />
                </div>
                <div>
                  <h3 className="text-white text-lg mb-1" style={{ fontFamily: 'var(--font-outfit)', fontWeight: 500 }}>
                    Senha atualizada!
                  </h3>
                  <p className="text-[#666] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                    Sua senha foi redefinida com sucesso.
                  </p>
                </div>
                <button
                  onClick={() => router.push('/')}
                  className="w-full py-3 rounded-xl text-sm font-semibold text-[#070707] transition-all duration-200 hover:brightness-110"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                >
                  Ir para o início
                </button>
              </div>
            )}

            {/* Voltar para login */}
            <div className="mt-7 pt-6 border-t border-[#141414] text-center">
              <a
                href="/auth"
                className="inline-flex items-center gap-1.5 text-[#3a3a3a] text-xs hover:text-[#666] transition-colors"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                <ArrowLeft size={12} />
                Voltar para o login
              </a>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}
