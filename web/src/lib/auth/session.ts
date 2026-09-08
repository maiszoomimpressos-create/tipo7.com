'use client'

// Singleton de sessão do AuthModule próprio (Fase 6) — substitui o client
// interno de sessão do supabase-js. Guarda o access token em memória +
// localStorage, renova proativamente via /api/auth/refresh (o refresh_token
// httpOnly é enviado automaticamente pelo browser, não precisa ser lido
// aqui). AuthContext.tsx é só um wrapper React fino em cima disso.
import type { Session } from './types';

const STORAGE_KEY = 'tipo7_session';
const REFRESH_MARGIN_MS = 5 * 60 * 1000; // renova 5min antes de expirar

type Listener = (session: Session | null) => void;

let currentSession: Session | null = null;
let initialized = false;
let refreshTimer: ReturnType<typeof setTimeout> | null = null;
const listeners = new Set<Listener>();

// Achado real (07/09/2026, terminal token+PIN da GPOS780): initSession()
// pode disparar um doRefresh() assíncrono (refresh via cookie httpOnly) da
// sessão ANTERIOR ainda ativa no aparelho (ex: operador anterior não
// desconectou, só recarregou a página). Se esse refresh demorar e só
// resolver DEPOIS de um novo login por token+PIN já ter chamado
// setSessionFromAccessToken(), o `persist()` do refresh tardio sobrescrevia
// a sessão nova pela antiga silenciosamente — o operador via a tela de erro
// de "sem caixa"/permissão errada mesmo com token+PIN corretos, porque as
// chamadas seguintes (meu-caixa/meu-acesso) iam com o Bearer de outra
// pessoa. Contador de geração: cada persist() incrementa; doRefresh()
// captura a geração no início e só aplica o próprio resultado se ninguém
// mudou a sessão enquanto ele esperava a rede.
let sessionGeneration = 0;

function readCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|; )${name}=([^;]*)`));
  return match ? decodeURIComponent(match[1]) : null;
}

interface JwtPayload {
  sub: string;
  email?: string;
  exp?: number;
  user_metadata?: { full_name?: string };
}

function decodeJwtPayload(token: string): JwtPayload | null {
  try {
    const payloadB64 = token.split('.')[1];
    const json = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(json) as JwtPayload;
  } catch {
    return null;
  }
}

function sessionFromAccessToken(token: string): Session | null {
  const payload = decodeJwtPayload(token);
  if (!payload?.sub || !payload.exp) return null;
  return {
    accessToken: token,
    expiresAt: payload.exp * 1000,
    user: { id: payload.sub, email: payload.email ?? '', fullName: payload.user_metadata?.full_name ?? null },
  };
}

function persist(session: Session | null) {
  sessionGeneration++;
  currentSession = session;
  try {
    if (session) localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else localStorage.removeItem(STORAGE_KEY);
  } catch {
    // localStorage indisponível (modo privado etc.) — sessão só em memória
  }
  listeners.forEach((l) => l(session));
}

function scheduleRefresh() {
  if (refreshTimer) clearTimeout(refreshTimer);
  if (!currentSession) return;
  const delay = Math.max(0, currentSession.expiresAt - Date.now() - REFRESH_MARGIN_MS);
  refreshTimer = setTimeout(() => {
    doRefresh().then(scheduleRefresh);
  }, delay);
}

async function doRefresh(): Promise<Session | null> {
  const geracaoAoIniciar = sessionGeneration;
  try {
    const res = await fetch('/api/auth/refresh', { method: 'POST', credentials: 'include' });
    if (!res.ok) {
      if (sessionGeneration === geracaoAoIniciar) persist(null);
      return null;
    }
    const data = (await res.json()) as { accessToken: string };
    const session = sessionFromAccessToken(data.accessToken);
    // Se a sessão mudou enquanto essa chamada de rede estava em voo (ex:
    // login por token+PIN novo aconteceu nesse meio-tempo), essa resposta
    // é de uma identidade que não existe mais — descarta em vez de
    // sobrescrever a sessão atual (ver comentário na declaração de
    // sessionGeneration).
    if (sessionGeneration === geracaoAoIniciar) persist(session);
    return session;
  } catch {
    return null;
  }
}

export function getSession(): Session | null {
  return currentSession;
}

export function getAccessToken(): string | null {
  return currentSession?.accessToken ?? null;
}

export function setSessionFromAccessToken(accessToken: string) {
  persist(sessionFromAccessToken(accessToken));
  scheduleRefresh();
}

export async function clearSession() {
  if (refreshTimer) clearTimeout(refreshTimer);
  await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' }).catch(() => {});
  persist(null);
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

// Roda uma vez no mount do AuthProvider. Ordem de tentativa: localStorage
// (rápido, sem round-trip) → cookie access_token (ex: acabou de voltar de
// um redirect do Google) → refresh via cookie httpOnly (sessão persistida
// mas token expirado/ausente da memória, ex: primeira carga após reabrir o navegador).
export async function initSession(): Promise<Session | null> {
  if (initialized) return currentSession;
  initialized = true;

  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Session;
      if (parsed.expiresAt > Date.now() + REFRESH_MARGIN_MS) {
        persist(parsed);
        scheduleRefresh();
        return parsed;
      }
    }
  } catch {
    // ignora localStorage corrompido
  }

  const cookieToken = readCookie('access_token');
  if (cookieToken) {
    const session = sessionFromAccessToken(cookieToken);
    if (session && session.expiresAt > Date.now()) {
      persist(session);
      scheduleRefresh();
      return session;
    }
  }

  const refreshed = await doRefresh();
  scheduleRefresh();
  return refreshed;
}
