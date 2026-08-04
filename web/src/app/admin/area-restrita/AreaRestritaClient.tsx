'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Lock, ShieldCheck, Loader2, Eye, EyeOff, KeyRound } from 'lucide-react'
import { apiFetchAuth } from '@/lib/apiFetch'

const ACCENT = '#E8B84B'

interface Props {
  temSenha: boolean
  destino:  string
}

type Modo = 'entrar' | 'criar' | 'trocar' | 'recuperar'

export function AreaRestritaClient({ temSenha, destino }: Props) {
  const router = useRouter()
  const [modo, setModo] = useState<Modo>(temSenha ? 'entrar' : 'criar')

  const [senha,        setSenha]        = useState('')
  const [senhaAtual,   setSenhaAtual]   = useState('')
  const [senhaLogin,   setSenhaLogin]   = useState('')
  const [novaSenha,    setNovaSenha]    = useState('')
  const [confirmar,    setConfirmar]    = useState('')
  const [mostrar,      setMostrar]      = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [erro,         setErro]         = useState<string | null>(null)

  function trocarModo(m: Modo) {
    setModo(m); setErro(null)
    setSenha(''); setSenhaAtual(''); setSenhaLogin(''); setNovaSenha(''); setConfirmar('')
  }

  async function entrar(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setErro(null)
    try {
      const res  = await apiFetchAuth('/api/admin/area-restrita/desbloquear', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ senha }),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao desbloquear'); return }
      router.push(destino)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  async function salvarSenha(e: React.FormEvent) {
    e.preventDefault()
    if (novaSenha.length < 6) { setErro('A senha precisa ter pelo menos 6 caracteres'); return }
    if (novaSenha !== confirmar) { setErro('As senhas não coincidem'); return }
    if (modo === 'recuperar' && !senhaLogin) { setErro('Informe sua senha de login'); return }

    setLoading(true); setErro(null)
    try {
      const endpoint = modo === 'recuperar' ? '/api/admin/area-restrita/recuperar' : '/api/admin/area-restrita/senha'
      const body = modo === 'recuperar'
        ? { senhaLogin, novaSenha }
        : modo === 'trocar' ? { senhaAtual, novaSenha } : { novaSenha }

      const res  = await apiFetchAuth(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) { setErro(data.error ?? 'Erro ao salvar senha'); return }
      router.push(destino)
    } catch {
      setErro('Erro de conexão. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const inputCls = 'w-full bg-[#111] border border-[#222] rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-[#E8B84B]/40 placeholder:text-[#2e2e2e]'
  const labelCls = 'text-[#666] text-[11px] font-medium tracking-widest uppercase'

  return (
    <div className="w-full max-w-sm rounded-2xl p-7 flex flex-col gap-5" style={{ background: '#0d0d0d', border: '1px solid #1a1a1a' }}>

      <div className="flex flex-col items-center gap-3 text-center">
        <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
             style={{ background: `${ACCENT}15`, border: `1px solid ${ACCENT}30` }}>
          {modo === 'entrar' ? <Lock size={20} style={{ color: ACCENT }} /> : <KeyRound size={20} style={{ color: ACCENT }} />}
        </div>
        <div>
          <p className="text-white text-base font-medium" style={{ fontFamily: 'var(--font-outfit)' }}>
            {modo === 'entrar'    && 'Área restrita'}
            {modo === 'criar'     && 'Cadastre sua senha de acesso'}
            {modo === 'trocar'    && 'Trocar senha de acesso'}
            {modo === 'recuperar' && 'Recuperar senha de acesso'}
          </p>
          <p className="text-[#555] text-xs mt-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {modo === 'entrar'    && 'Digite sua senha própria para entrar em Equipe, Financeiro e API.'}
            {modo === 'criar'     && 'Essa senha é separada da sua senha de login — só ela abre Equipe, Financeiro e API.'}
            {modo === 'trocar'    && 'Confirme a senha atual e defina uma nova.'}
            {modo === 'recuperar' && 'Confirme com sua senha de login (a mesma de entrar no Tipo7) e defina uma nova senha de acesso.'}
          </p>
        </div>
      </div>

      {modo === 'entrar' ? (
        <form onSubmit={entrar} className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Senha de acesso</label>
            <div className="relative">
              <input
                type={mostrar ? 'text' : 'password'}
                value={senha}
                onChange={e => setSenha(e.target.value)}
                autoFocus
                autoComplete="off"
                className={`${inputCls} pr-10`}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <button type="button" onClick={() => setMostrar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888]">
                {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {erro && <p className="text-red-400 text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

          <button type="submit" disabled={loading || !senha}
            className="w-full py-3 rounded-xl text-sm font-semibold text-center transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: ACCENT, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : <><ShieldCheck size={14} /> Desbloquear</>}
          </button>

          <div className="flex items-center justify-center gap-4">
            <button type="button" onClick={() => trocarModo('trocar')}
              className="text-[#444] hover:text-[#777] text-xs text-center transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Trocar senha
            </button>
            <span className="text-[#222] text-xs">·</span>
            <button type="button" onClick={() => trocarModo('recuperar')}
              className="text-[#444] hover:text-[#777] text-xs text-center transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Esqueci minha senha
            </button>
          </div>
        </form>
      ) : (
        <form onSubmit={salvarSenha} className="flex flex-col gap-4">
          {modo === 'trocar' && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Senha atual</label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={senhaAtual}
                onChange={e => setSenhaAtual(e.target.value)}
                autoFocus
                autoComplete="off"
                className={inputCls}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
          )}
          {modo === 'recuperar' && (
            <div className="flex flex-col gap-1.5">
              <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Senha de login (Tipo7)</label>
              <input
                type={mostrar ? 'text' : 'password'}
                value={senhaLogin}
                onChange={e => setSenhaLogin(e.target.value)}
                autoFocus
                autoComplete="off"
                className={inputCls}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
            </div>
          )}
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Nova senha</label>
            <input
              type={mostrar ? 'text' : 'password'}
              value={novaSenha}
              onChange={e => setNovaSenha(e.target.value)}
              autoComplete="off"
              placeholder="Mínimo 6 caracteres"
              className={inputCls}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label className={labelCls} style={{ fontFamily: 'var(--font-dm-sans)' }}>Confirmar nova senha</label>
            <div className="relative">
              <input
                type={mostrar ? 'text' : 'password'}
                value={confirmar}
                onChange={e => setConfirmar(e.target.value)}
                autoComplete="off"
                className={`${inputCls} pr-10`}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              />
              <button type="button" onClick={() => setMostrar(v => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-[#444] hover:text-[#888]">
                {mostrar ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
          </div>

          {erro && <p className="text-red-400 text-xs text-center" style={{ fontFamily: 'var(--font-dm-sans)' }}>{erro}</p>}

          <button type="submit" disabled={loading}
            className="w-full py-3 rounded-xl text-sm font-semibold text-center transition-all hover:brightness-110 disabled:opacity-40 flex items-center justify-center gap-2"
            style={{ background: ACCENT, color: '#070707', fontFamily: 'var(--font-dm-sans)' }}>
            {loading ? <Loader2 size={14} className="animate-spin" /> : 'Salvar senha'}
          </button>

          {temSenha && (
            <button type="button" onClick={() => trocarModo('entrar')}
              className="text-[#444] hover:text-[#777] text-xs text-center transition-colors"
              style={{ fontFamily: 'var(--font-dm-sans)' }}>
              ← Voltar
            </button>
          )}
        </form>
      )}
    </div>
  )
}
