'use client'

// Header principal da plataforma Tipo7
// Quando logado: exibe inicial do usuário + menu dropdown com opções de conta
// Quando deslogado: exibe botão "Entrar / Cadastrar" que vai para /auth
import { useState, useEffect, useRef } from 'react'
import { Ticket, Menu, X, ArrowRight, LogOut, User, ChevronDown, CalendarPlus, Settings2 } from 'lucide-react'

const ADMIN_EMAIL = 'maiszoomimpressos@gmail.com'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useProfileStatus } from '@/hooks/useProfileStatus'

export function Header() {
  const { user, loading, signOut }    = useAuth()
  const { incompleto, camposFaltando } = useProfileStatus()

  const [menuOpen,    setMenuOpen]    = useState(false)  // menu mobile
  const [scrolled,    setScrolled]    = useState(false)  // efeito ao rolar
  const [userMenuOpen, setUserMenuOpen] = useState(false) // dropdown do usuário

  const userMenuRef = useRef<HTMLDivElement>(null)

  // Fundo mais opaco quando rola para baixo
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Fecha menu mobile ao redimensionar para desktop
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 768) setMenuOpen(false) }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Fecha dropdown do usuário ao clicar fora
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  // Pega a inicial do nome ou email do usuário para exibir no avatar
  const userInitial = user?.user_metadata?.full_name
    ? (user.user_metadata.full_name as string).charAt(0).toUpperCase()
    : user?.email?.charAt(0).toUpperCase() ?? '?'

  // Nome de exibição curto
  const displayName = (user?.user_metadata?.full_name as string | undefined)?.split(' ')[0]
    ?? user?.email?.split('@')[0]
    ?? 'Minha conta'

  const handleSignOut = async () => {
    setUserMenuOpen(false)
    setMenuOpen(false)
    await signOut()
    sessionStorage.removeItem('tipo7_perfil_modal_visto')
    window.location.href = '/'
  }

  return (
    <>
      {/* ─── Barra de navegação ─────────────────────────────────── */}
      <header
        className={cn(
          'fixed top-0 left-0 right-0 z-50 h-[60px] transition-all duration-300',
          scrolled
            ? 'bg-[#070707]/95 backdrop-blur-md border-b border-[#E8B84B]/20'
            : 'bg-[#070707]/80 backdrop-blur-sm border-b border-white/5'
        )}
      >
        <div className="max-w-7xl mx-auto h-full px-4 md:px-8 flex items-center justify-between">

          {/* Logo ─────────────────────────────────────────────── */}
          <a
            href="/"
            className="flex items-center gap-2.5 group select-none"
            aria-label="Tipo7 — página inicial"
          >
            <div className="relative">
              <Ticket
                size={22}
                className="text-[#E8B84B] transition-transform duration-300 group-hover:rotate-12"
                strokeWidth={2}
              />
              <div className="absolute inset-0 bg-[#E8B84B]/20 blur-md scale-150 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            </div>
            <span
              className="text-[17px] tracking-tight leading-none"
              style={{ fontFamily: 'var(--font-syne)', fontWeight: 800 }}
            >
              <span className="text-white">tipo</span>
              <span className="text-[#E8B84B]">7</span>
            </span>
          </a>

          {/* Área direita — desktop ────────────────────────────── */}
          <div className="hidden md:flex items-center">

            {/* Ainda verificando sessão — esqueleto sutil */}
            {loading && (
              <div className="w-[140px] h-9 rounded-full bg-white/5 animate-pulse" />
            )}

            {/* Usuário NÃO logado — botão de acesso */}
            {!loading && !user && (
              <a
                href="/auth"
                className={cn(
                  'group flex items-center gap-2 px-5 py-2 rounded-full text-sm font-semibold',
                  'bg-[#E8B84B] text-[#070707]',
                  'hover:bg-[#F0C96A] transition-all duration-200',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E8B84B]/50'
                )}
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                Entrar / Cadastrar
                <ArrowRight size={15} strokeWidth={2.5} className="transition-transform duration-200 group-hover:translate-x-0.5" />
              </a>
            )}

            {/* Usuário LOGADO — avatar + dropdown */}
            {!loading && user && (
              <div className="flex items-center gap-2">

              {/* Botão admin — só aparece para o dono da plataforma */}
              {user.email === ADMIN_EMAIL && (
                <a
                  href="/admin"
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[#E8B84B] border border-[#E8B84B]/25 hover:bg-[#E8B84B]/8 transition-colors"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                  title="Painel de gerenciamento"
                >
                  <Settings2 size={13} />
                  Ger. Sistema
                </a>
              )}

              <div className="relative" ref={userMenuRef}>
                <button
                  onClick={() => setUserMenuOpen(v => !v)}
                  className={cn(
                    'flex items-center gap-2.5 pl-1 pr-3 py-1 rounded-full transition-all duration-200',
                    'border border-[#222] hover:border-[#E8B84B]/40 bg-[#111]',
                    userMenuOpen && 'border-[#E8B84B]/40'
                  )}
                  aria-expanded={userMenuOpen}
                  aria-label="Menu da conta"
                >
                  {/* Avatar com inicial + bolinha vermelha se perfil incompleto */}
                  <div className="relative shrink-0">
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-[#070707]"
                      style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}
                    >
                      {userInitial}
                    </div>
                    {incompleto && (
                      <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#070707]" />
                    )}
                  </div>
                  <span
                    className="text-sm text-white/80 max-w-[100px] truncate"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {displayName}
                  </span>
                  <ChevronDown
                    size={13}
                    className={cn('text-[#555] transition-transform duration-200', userMenuOpen && 'rotate-180')}
                  />
                </button>

                {/* Dropdown */}
                {userMenuOpen && (
                  <div className="absolute right-0 top-[calc(100%+8px)] w-52 bg-[#0d0d0d] border border-[#1c1c1c] rounded-xl overflow-hidden shadow-xl shadow-black/50">
                    {/* Info do usuário */}
                    <div className="px-4 py-3 border-b border-[#1a1a1a]">
                      <p className="text-white text-sm font-medium truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {displayName}
                      </p>
                      <p className="text-[#555] text-xs truncate" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                        {user.email}
                      </p>
                    </div>
                    {/* Aviso de perfil incompleto */}
                    {incompleto && (
                      <a
                        href="/perfil"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-start gap-2.5 px-4 py-3 bg-red-500/8 border-b border-red-500/15 hover:bg-red-500/12 transition-colors"
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-red-500 shrink-0 mt-1.5" />
                        <div>
                          <p className="text-red-400 text-xs font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            Perfil incompleto
                          </p>
                          <p className="text-red-400/60 text-[11px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                            {camposFaltando.map(c => c.label).join(', ')}
                          </p>
                        </div>
                      </a>
                    )}

                    {/* Opções */}
                    <div className="py-1">
                      <a
                        href="/perfil"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#bbb] hover:text-white hover:bg-white/5 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        <User size={14} className="text-[#555]" />
                        Meu perfil
                      </a>
                      <a
                        href="/comprador/ingressos"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#bbb] hover:text-white hover:bg-white/5 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        <Ticket size={14} className="text-[#555]" />
                        Meus ingressos
                      </a>
                    </div>

                    {/* Separador + ação de criação */}
                    <div className="border-t border-[#1a1a1a] py-1">
                      <a
                        href="/criar-evento"
                        onClick={() => setUserMenuOpen(false)}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-[#E8B84B] hover:text-[#F0C96A] hover:bg-[#E8B84B]/5 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        <CalendarPlus size={14} />
                        Criar evento
                      </a>
                    </div>

                    {/* Separador + sair */}
                    <div className="border-t border-[#1a1a1a] py-1">
                      <button
                        onClick={handleSignOut}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-[#bbb] hover:text-red-400 hover:bg-red-400/5 transition-colors"
                        style={{ fontFamily: 'var(--font-dm-sans)' }}
                      >
                        <LogOut size={14} className="text-[#555]" />
                        Sair
                      </button>
                    </div>
                  </div>
                )}
              </div>
              </div>
            )}
          </div>

          {/* Botão hambúrguer — mobile ─────────────────────────── */}
          <button
            className="md:hidden flex items-center justify-center w-9 h-9 rounded-lg text-white/70 hover:text-white hover:bg-white/5 transition-colors"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label={menuOpen ? 'Fechar menu' : 'Abrir menu'}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>

        </div>
      </header>

      {/* ─── Menu mobile (tela cheia) ───────────────────────────── */}
      <div
        className={cn(
          'fixed inset-0 z-40 flex flex-col md:hidden transition-all duration-300',
          'bg-[#070707]/98 backdrop-blur-xl pt-[60px]',
          menuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        )}
        aria-hidden={!menuOpen}
      >
        <div className="flex flex-col items-center justify-center flex-1 gap-6 px-8">

          {/* Usuário NÃO logado */}
          {!user && (
            <a
              href="/auth"
              className={cn(
                'w-full flex items-center justify-center gap-2 px-6 py-3.5 rounded-full',
                'bg-[#E8B84B] text-[#070707] text-base font-semibold',
                'hover:bg-[#F0C96A] transition-colors duration-200'
              )}
              style={{ fontFamily: 'var(--font-dm-sans)' }}
              onClick={() => setMenuOpen(false)}
            >
              Entrar / Cadastrar
              <ArrowRight size={16} strokeWidth={2.5} />
            </a>
          )}

          {/* Usuário LOGADO */}
          {user && (
            <>
              {/* Avatar + nome */}
              <div className="flex flex-col items-center gap-3">
                <div
                  className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold text-[#070707]"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-syne)' }}
                >
                  {userInitial}
                </div>
                <div className="text-center">
                  <p className="text-white font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>{displayName}</p>
                  <p className="text-[#555] text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>{user.email}</p>
                </div>
              </div>

              <div className="w-full h-px bg-white/5" />

              <div className="w-full flex flex-col gap-2">
                <a
                  href="/perfil"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#222] text-white text-sm"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  <User size={15} />
                  Meu perfil
                </a>
                <a
                  href="/comprador/ingressos"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#222] text-white text-sm"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  <Ticket size={15} />
                  Meus ingressos
                </a>
                {/* Criar evento — destaque dourado */}
                <a
                  href="/criar-evento"
                  onClick={() => setMenuOpen(false)}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl text-sm font-semibold text-[#070707]"
                  style={{ background: '#E8B84B', fontFamily: 'var(--font-dm-sans)' }}
                >
                  <CalendarPlus size={15} />
                  Criar evento
                </a>
                {/* Botão admin — só aparece para o dono da plataforma */}
                {user.email === ADMIN_EMAIL && (
                  <a
                    href="/admin"
                    onClick={() => setMenuOpen(false)}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl border border-[#E8B84B]/30 text-[#E8B84B] text-sm font-medium"
                    style={{ fontFamily: 'var(--font-dm-sans)' }}
                  >
                    <Settings2 size={15} />
                    Ger. Sistema
                  </a>
                )}
              </div>

              <button
                onClick={handleSignOut}
                className="text-red-400 text-sm flex items-center gap-2"
                style={{ fontFamily: 'var(--font-dm-sans)' }}
              >
                <LogOut size={14} />
                Sair da conta
              </button>
            </>
          )}

          {/* Texto de apoio — apenas para visitantes */}
          {!user && (
            <>
              <div className="w-full h-px bg-white/5" />
              <p className="text-[#888888] text-sm text-center">
                Compre ingressos, crie eventos ou gerencie sua equipe — tudo em um só lugar.
              </p>
            </>
          )}

        </div>
      </div>

      {/* Espaçador para o conteúdo não ficar atrás do header fixo */}
      <div className="h-[60px]" aria-hidden="true" />
    </>
  )
}
