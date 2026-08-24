'use client'

import { useState } from 'react'
import { AlertCircle, Check } from 'lucide-react'

const ACCENT = '#E8B84B'

export interface PermissaoInfo {
  value: string
  label: string
  desc:  string
  help:  string
}

// Fonte única das 8 permissões de equipe — label curto (some no cartão),
// desc (subtítulo) e help (texto completo, só aparece no tooltip). Usado
// tanto no seletor por evento (PainelEquipe.tsx) quanto nos modelos de
// função reutilizáveis (admin/funcoes/FuncoesClient.tsx) — extraído
// 26/08/2026 pra não duplicar o texto de ajuda em dois lugares (pedido do
// usuário: os cards de /admin/funcoes não explicavam o que cada permissão
// fazia, só o seletor dentro do evento tinha isso).
export const PERMISSOES_INFO: PermissaoInfo[] = [
  { value: 'validar_ingresso',        label: 'Portaria',             desc: 'Escanear QR na entrada',
    help: 'Libera a tela "Scanner" no evento. Quem tem essa permissão pode escanear o QR code do ingresso na entrada e marcar como usado — impede que o mesmo ingresso entre duas vezes.' },
  { value: 'vender_ingresso',         label: 'Bilheteria',           desc: 'Vender ingressos presencial',
    help: 'Libera a tela de "Bilheteria". Quem tem essa permissão pode abrir/operar um caixa e vender ingresso presencialmente (dinheiro, PIX ou cartão), sem precisar de link de compra.' },
  { value: 'estacionamento_entrada',  label: 'Estacionamento',       desc: 'Registrar entrada de veículos',
    help: 'Libera a tela de "Estacionamento", só a parte de ENTRADA — registrar placa/modelo/cor do carro que está chegando. Sozinha, não deixa registrar saída nem cobrar.' },
  { value: 'autorizar_sangria',       label: 'Autorizar sangria',    desc: 'Confirmar retirada de dinheiro de um caixa',
    help: 'Permite que ESSA função autorize a sangria (retirada parcial de dinheiro) de qualquer caixa do evento, digitando o PIN dela na hora — quem opera a tela não precisa ser a mesma pessoa que retira o dinheiro.' },
  { value: 'ver_lista_convidados',    label: 'Ver lista',            desc: 'Lista de compradores',
    help: 'Libera a tela com a lista de quem comprou ingresso pro evento (nome, ingresso, se já entrou) — só consulta, não deixa vender nem escanear.' },
  { value: 'ver_relatorios',          label: 'Ver relatórios',       desc: 'Vendas e presença',
    help: 'Libera o dashboard de vendas/presença do evento (quanto vendeu, quantos entraram, por forma de pagamento) — visão gerencial, não operacional.' },
  { value: 'gerenciar_checkin',       label: 'Gerenciar check-in',   desc: 'Controlar entrada/saída',
    help: 'Permite marcar manualmente entrada/saída de convidados direto na lista, sem precisar escanear o QR — útil quando o ingresso não tem QR ou o scanner falhou.' },
  { value: 'estacionamento_saida',    label: 'Estacionamento',       desc: 'Registrar saída e cobrar',
    help: 'Libera a tela de "Estacionamento", a parte de SAÍDA — dar baixa no carro e cobrar o valor (se o local for pago). Sozinha, não deixa registrar entrada.' },
]

// Botão "?" com tooltip — clique ou hover revela o texto, escondido por
// padrão. Sempre chama stopPropagation pra não disparar o toggle da
// permissão por baixo (o card inteiro é clicável).
export function BotaoAjuda({ texto }: { texto: string }) {
  const [aberta, setAberta] = useState(false)
  return (
    <span className="relative inline-block shrink-0">
      <button
        type="button"
        onClick={e => { e.stopPropagation(); setAberta(v => !v) }}
        onMouseEnter={() => setAberta(true)}
        onMouseLeave={() => setAberta(false)}
        className="w-4 h-4 flex items-center justify-center rounded-full text-[#555] hover:text-[#E8B84B] transition-colors"
      >
        <AlertCircle size={13} />
      </button>
      {aberta && (
        <div
          onClick={e => e.stopPropagation()}
          className="absolute left-0 top-full mt-1.5 z-30 w-52 p-2.5 rounded-lg text-[10px] leading-snug text-[#ccc] shadow-xl shadow-black/50"
          style={{ background: '#1a1a1a', border: '1px solid #2a2a2a', fontFamily: 'var(--font-dm-sans)' }}
        >
          {texto}
        </div>
      )}
    </span>
  )
}

// Card de permissão — checkbox + label + descrição curta + ícone de ajuda
// com o texto completo. Reaproveitado no seletor por evento e nos modelos
// de função do admin.
export function BotaoPermissao({ p, marcada, onClick }: { p: PermissaoInfo; marcada: boolean; onClick: () => void }) {
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } }}
      className="flex items-start gap-2 p-2.5 rounded-xl text-left transition-colors cursor-pointer"
      style={{
        background: marcada ? `${ACCENT}15` : '#111',
        border: `1px solid ${marcada ? ACCENT + '40' : '#1e1e1e'}`,
      }}
    >
      <div
        className="w-4 h-4 rounded flex items-center justify-center shrink-0 mt-0.5"
        style={{
          background: marcada ? ACCENT : '#1a1a1a',
          border: `1px solid ${marcada ? ACCENT : '#333'}`,
        }}
      >
        {marcada && <Check size={10} className="text-[#070707]" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <p className="text-white text-[11px] font-medium leading-tight" style={{ fontFamily: 'var(--font-dm-sans)' }}>
            {p.label}
          </p>
          <BotaoAjuda texto={p.help} />
        </div>
        <p className="text-[#444] text-[10px]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          {p.desc}
        </p>
      </div>
    </div>
  )
}
