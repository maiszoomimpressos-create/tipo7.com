'use client'

import { RotateCw } from 'lucide-react'

// Achado de segurança (03/09/2026): o botão aqui antes era um link "Voltar
// ao evento" pro hub (`/trabalho/[eventoId]`) — que expõe "Meus trabalhos"
// (painel pessoal, todos os eventos da conta) e outras ferramentas fora do
// escopo. Num terminal público (GPOS780) isso é navegação demais. Como essa
// tela ("aguardando abertura do caixa") só precisa checar de novo se o
// caixa já foi aberto, um recarregar resolve sem sair do escopo — funciona
// igual em qualquer contexto, não precisa nem saber se é o app nativo.
export function AtualizarButton() {
  return (
    <button
      type="button"
      onClick={() => window.location.reload()}
      className="flex items-center gap-2 mt-2 text-sm text-[#444] hover:text-white transition-colors"
      style={{ fontFamily: 'var(--font-dm-sans)' }}
    >
      <RotateCw size={14} />
      Atualizar
    </button>
  )
}
