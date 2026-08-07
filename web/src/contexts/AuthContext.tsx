'use client'

// Contexto de autenticação — compartilha o usuário logado com toda a aplicação.
// Fase 6: AuthModule próprio no NestJS (server/src/auth-core/), substitui o
// Supabase Auth por completo. A assinatura pública (useAuth()) continua
// idêntica de propósito — só troca o que tem por baixo (ver web/src/lib/auth/session.ts).
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  clearSession,
  getSession,
  initSession,
  setSessionFromAccessToken,
  subscribe,
} from '@/lib/auth/session'
import type { Session as InternalSession } from '@/lib/auth/types'
import { apiFetchAuth } from '@/lib/apiFetch'

interface SignUpData {
  name:      string
  email:     string
  password:  string
  phone?:    string  // opcional — pode preencher depois no perfil
  cpf?:      string  // opcional — obrigatório só na hora do pagamento
  birthDate?: string // opcional — formato ISO: YYYY-MM-DD
  // Campos extras — só preenchidos quando vêm de um match confirmado na
  // Autosave durante o cadastro (ver /api/auth/cpf-confirmar)
  rg?:            string
  zipCode?:       string
  street?:        string
  streetNumber?:  string
  neighborhood?:  string
  city?:          string
  state?:         string
  complement?:    string
}

// Formato compatível com o que os componentes já consumiam do supabase-js
// (user.id, user.email, user.user_metadata?.full_name) — evita tocar em
// todo consumidor de useAuth() espalhado pela base.
interface AuthUser {
  id: string
  email: string
  user_metadata: { full_name?: string }
}

interface AuthSession {
  accessToken: string
  expiresAt: number
}

interface AuthContextValue {
  user:             AuthUser | null
  session:          AuthSession | null
  loading:          boolean
  signIn:           (email: string, password: string) => Promise<{ error: string | null }>
  signUp:           (data: SignUpData) => Promise<{ error: string | null }>
  signOut:          () => Promise<void>
  signInWithSocial: (provider: 'google' | 'facebook') => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

function toAuthUser(session: InternalSession | null): AuthUser | null {
  if (!session) return null
  return {
    id: session.user.id,
    email: session.user.email,
    user_metadata: { full_name: session.user.fullName ?? undefined },
  }
}

function toAuthSession(session: InternalSession | null): AuthSession | null {
  if (!session) return null
  return { accessToken: session.accessToken, expiresAt: session.expiresAt }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [internalSession, setInternalSession] = useState<InternalSession | null>(() => getSession())
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const unsubscribe = subscribe(setInternalSession)
    // Achado real (07/08/2026): initSession() resolve de forma SÍNCRONA
    // quando acha sessão válida em localStorage/cookie (só o fallback via
    // /api/auth/refresh é assíncrono de verdade). React roda o efeito de
    // componentes FILHOS antes do efeito deste Provider (pai) — se algum
    // filho da árvore também chamar apiFetchAuth (que também chama
    // initSession() por baixo) no próprio efeito, ele "ganha a corrida":
    // resolve a sessão E chama persist() ANTES do subscribe() acima rodar,
    // então o listener nunca é notificado dessa resolução. O token
    // continua válido (é por isso que checkout/APIs sempre funcionavam),
    // mas o header nunca aprendia disso e ficava preso em "deslogado" até
    // a próxima renovação de sessão de verdade. Corrigido aplicando
    // diretamente o valor de retorno de initSession() aqui, em vez de
    // confiar só no listener pra pegar a atualização — cobre os dois
    // casos (quem ganhou a corrida e quem não ganhou).
    initSession().then(setInternalSession).finally(() => setLoading(false))
    return unsubscribe
  }, [])

  // Login com email e senha
  const signIn = async (email: string, password: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ email, password }),
      })
      if (!res.ok) return { error: 'Email ou senha incorretos.' }
      const data = await res.json() as { accessToken: string }
      setSessionFromAccessToken(data.accessToken)
      return { error: null }
    } catch {
      return { error: 'Erro de conexão. Tente novamente.' }
    }
  }

  // Cria uma nova conta — dados extras salvos direto pelo AuthService.register()
  const signUp = async ({
    name, email, password, phone, cpf, birthDate,
    rg, zipCode, street, streetNumber, neighborhood, city, state, complement,
  }: SignUpData) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          email, password,
          fullName:     name,
          phone:        phone        || undefined,
          cpf:          cpf          || undefined,
          birthDate:    birthDate    || undefined,
          rg:           rg           || undefined,
          zipCode:      zipCode      || undefined,
          street:       street       || undefined,
          streetNumber: streetNumber || undefined,
          neighborhood: neighborhood || undefined,
          city:         city         || undefined,
          state:        state        || undefined,
          complement:   complement   || undefined,
        }),
      })
      const data = await res.json() as { accessToken?: string; message?: string }
      if (!res.ok) return { error: data.message ?? 'Erro ao criar conta. Tente novamente.' }
      if (data.accessToken) setSessionFromAccessToken(data.accessToken)
      // Manda o cadastro recém-criado pra Autosave (best-effort — não
      // espera nem bloqueia o cadastro se a Autosave estiver fora do ar)
      apiFetchAuth('/api/auth/sync-autosave', { method: 'POST' }).catch(() => {})
      return { error: null }
    } catch {
      return { error: 'Erro ao criar conta. Verifique sua conexão.' }
    }
  }

  // Desloga o usuário
  const signOut = async () => {
    await clearSession()
  }

  // Login social — Google usa navegação de página inteira (mesmo padrão de
  // mp/pagbank connect); o One Tap (auth/page.tsx) chama /auth/google/onetap
  // direto e não passa por aqui. Facebook não está configurado hoje.
  const signInWithSocial = async (provider: 'google' | 'facebook') => {
    if (provider === 'facebook') return { error: 'Login com Facebook indisponível no momento.' }
    window.location.href = `/api/auth/google?next=${encodeURIComponent(location.pathname + location.search)}`
    return { error: null }
  }

  const value: AuthContextValue = {
    user: toAuthUser(internalSession),
    session: toAuthSession(internalSession),
    loading,
    signIn,
    signUp,
    signOut,
    signInWithSocial,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

// Hook para consumir o contexto em qualquer componente
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
