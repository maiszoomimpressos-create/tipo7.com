'use client'

// Contexto de autenticação — compartilha o usuário logado com toda a aplicação
// Conecta com o Supabase Auth para login, cadastro, logout e sessão
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { type User, type Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

interface SignUpData {
  name:      string
  email:     string
  password:  string
  phone?:    string  // opcional — pode preencher depois no perfil
  cpf?:      string  // opcional — obrigatório só na hora do pagamento
  birthDate?: string // opcional — formato ISO: YYYY-MM-DD
}

interface AuthContextValue {
  user:             User | null
  session:          Session | null
  loading:          boolean
  signIn:           (email: string, password: string) => Promise<{ error: string | null }>
  signUp:           (data: SignUpData) => Promise<{ error: string | null }>
  signOut:          () => Promise<void>
  signInWithSocial: (provider: 'google' | 'facebook') => Promise<{ error: string | null }>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = createClient()
  const [user,    setUser]    = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  // Verifica a sessão ao carregar e escuta mudanças de autenticação
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    // Listener — atualiza quando o usuário loga, desloga ou token é renovado
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
    })

    return () => subscription.unsubscribe()
  }, [])

  // Faz login com email e senha
  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: 'Email ou senha incorretos.' }
    return { error: null }
  }

  // Cria uma nova conta e envia email de confirmação
  // Todos os dados extras são salvos via trigger no banco (tabela profiles)
  const signUp = async ({ name, email, password, phone, cpf, birthDate }: SignUpData) => {
    try {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name:  name,
            phone:      phone     || null,
            cpf:        cpf       || null,
            birth_date: birthDate || null,
          },
          emailRedirectTo: `${location.origin}/auth/callback`,
        },
      })
      if (error) {
        const msg = error.message && !error.message.startsWith('{') && !error.message.startsWith('[')
          ? error.message
          : error.code ?? 'Erro ao criar conta. Tente novamente.'
        return { error: msg }
      }
      return { error: null }
    } catch {
      return { error: 'Erro ao criar conta. Verifique sua conexão.' }
    }
  }

  // Desloga o usuário
  const signOut = async () => {
    await supabase.auth.signOut()
  }

  // Login social via Facebook
  const signInWithSocial = async (provider: 'google' | 'facebook') => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${location.origin}/auth/callback`,
          scopes: provider === 'facebook' ? 'email,public_profile' : undefined,
        },
      })
      if (error) return { error: 'Não foi possível conectar. Tente novamente.' }
      return { error: null }
    } catch {
      return { error: 'Erro ao conectar com provedor social.' }
    }
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, signIn, signUp, signOut, signInWithSocial }}>
      {children}
    </AuthContext.Provider>
  )
}

// Hook para consumir o contexto em qualquer componente
export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth deve ser usado dentro de <AuthProvider>')
  return ctx
}
