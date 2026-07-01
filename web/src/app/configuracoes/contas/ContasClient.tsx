'use client'

import { useEffect, useState, useTransition } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle, AlertCircle, Loader2, LogOut } from 'lucide-react'
import { desconectarContaMP } from './actions'

type ContaMP = {
  mp_user_id: number
  mp_access_token: string
  mp_public_key: string | null
  updated_at: string
} | null

export function ContasClient({ contaAtual }: { contaAtual: ContaMP }) {
  const searchParams = useSearchParams()
  const [aviso, setAviso] = useState<{ tipo: 'ok' | 'erro'; msg: string } | null>(null)
  const [isPending, startTransition] = useTransition()

  // Lê o resultado do OAuth ao voltar do Mercado Pago
  useEffect(() => {
    if (searchParams.get('mp_ok')) {
      setAviso({ tipo: 'ok', msg: 'Mercado Pago conectado com sucesso!' })
    }
    const err = searchParams.get('mp_erro')
    if (err) {
      const msgs: Record<string, string> = {
        cancelado:  'Autorização cancelada.',
        parametros: 'Parâmetros inválidos retornados pelo Mercado Pago.',
        state:      'Erro de segurança — tente novamente.',
        token:      'Erro ao obter credenciais do Mercado Pago.',
        banco:      'Credenciais recebidas, mas houve erro ao salvar. Tente novamente.',
      }
      setAviso({ tipo: 'erro', msg: msgs[err] ?? 'Erro desconhecido.' })
    }
  }, [searchParams])

  function desconectar() {
    startTransition(async () => {
      await desconectarContaMP()
    })
  }

  const conectado = !!contaAtual

  return (
    <>
      {/* Aviso de retorno OAuth */}
      {aviso && (
        <div className={`flex items-start gap-2.5 px-4 py-3 rounded-xl mb-4 text-sm ${
          aviso.tipo === 'ok'
            ? 'bg-green-500/8 border border-green-500/20 text-green-400'
            : 'bg-red-500/8 border border-red-500/20 text-red-400'
        }`} style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {aviso.tipo === 'ok'
            ? <CheckCircle size={15} className="shrink-0 mt-0.5" />
            : <AlertCircle size={15} className="shrink-0 mt-0.5" />}
          {aviso.msg}
        </div>
      )}

      {/* ── Card Mercado Pago ─────────────────────────────────────── */}
      <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-2xl overflow-hidden">

        {/* Topo */}
        <div className="flex items-center gap-4 px-6 py-5 border-b border-[#141414]">
          <div className="w-14 h-14 rounded-xl bg-white flex items-center justify-center shrink-0 p-1.5">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/mercado-pago.svg" alt="Mercado Pago" className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-medium text-sm" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Mercado Pago
            </p>
            <p className="text-[#555] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Pagamentos via PIX, cartão de crédito e débito
            </p>
          </div>
          {conectado ? (
            <span className="flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-full border border-green-500/25 bg-green-500/8 text-green-400 shrink-0"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
              <CheckCircle size={10} />
              Conectado
            </span>
          ) : (
            <span className="text-[11px] px-2.5 py-1 rounded-full border border-[#222] bg-[#111] text-[#888] shrink-0"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}>
              Não conectado
            </span>
          )}
        </div>

        {/* Corpo */}
        <div className="px-6 py-5">
          {conectado ? (
            <>
              <p className="text-[#555] text-sm mb-1" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Conta conectada — ID <span className="text-[#888]">{contaAtual.mp_user_id}</span>
              </p>
              <p className="text-[#3a3a3a] text-xs mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Atualizado em {new Date(contaAtual.updated_at).toLocaleDateString('pt-BR')}
              </p>
              <div className="flex gap-3">
                <a
                  href="/api/mp/auth"
                  className="px-4 py-2.5 rounded-xl text-sm font-medium text-white border border-[#2a2a2a] hover:border-[#E8B84B]/40 hover:text-[#E8B84B] transition-all"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  Reconectar conta
                </a>
                <button
                  onClick={desconectar}
                  disabled={isPending}
                  className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-medium text-red-400/70 hover:text-red-400 border border-transparent hover:border-red-500/20 transition-all disabled:opacity-40"
                  style={{ fontFamily: 'var(--font-dm-sans)' }}
                >
                  {isPending ? <Loader2 size={13} className="animate-spin" /> : <LogOut size={13} />}
                  Desconectar
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-[#555] text-sm mb-5" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                Conecte sua conta para habilitar a divisão automática dos pagamentos entre a plataforma e o promotor.
              </p>
              <a
                href="/api/mp/auth"
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium text-white transition-all hover:brightness-110"
                style={{ background: '#009EE3', fontFamily: 'var(--font-dm-sans)' }}
              >
                Conectar com Mercado Pago
              </a>
            </>
          )}
        </div>
      </div>

      {/* ── Em breve ─────────────────────────────────────────────── */}
      <div className="mt-4 flex flex-col items-start gap-2">
        <div className="w-14 h-14 rounded-xl border-2 border-dashed border-[#222] flex items-center justify-center">
          <span className="text-[#333] text-xl font-bold" style={{ fontFamily: 'var(--font-syne)' }}>+</span>
        </div>
        <p className="text-[#3a3a3a] text-xs" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          Em breve mais opções
        </p>
      </div>
    </>
  )
}
