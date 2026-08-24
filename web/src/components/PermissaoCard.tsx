'use client'

import { useState } from 'react'
import { AlertCircle, Check, ChevronDown, ChevronUp, Wallet, ScanQrCode, Car, type LucideIcon } from 'lucide-react'

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
//
// Redesenho por LOCAL, mesma data (3ª correção do usuário na sessão — ver
// nota longa em MODULOS, PainelEquipe.tsx): o `label` de cada permissão
// aqui é o ATRIBUTO (Caixa, Scanner, Entrada, Saída), não o local — o
// local já vira o título do card/módulo que agrupa (Bilheteria, Portaria,
// Estacionamento). "Na bilheteria ela TEM um caixa" — o local é o
// agrupador, a permissão é só o que ela tem lá dentro.
export const PERMISSOES_INFO: PermissaoInfo[] = [
  { value: 'validar_ingresso',        label: 'Scanner',              desc: 'Escanear QR na entrada',
    help: 'Libera a tela "Scanner" no evento (Portaria). Quem tem essa permissão pode escanear o QR code do ingresso na entrada e marcar como usado — impede que o mesmo ingresso entre duas vezes.' },
  { value: 'vender_ingresso',         label: 'Caixa',                desc: 'Vender ingressos presencial',
    help: 'Libera a tela de "Bilheteria". Quem tem essa permissão pode abrir/operar um caixa e vender ingresso presencialmente (dinheiro, PIX ou cartão), sem precisar de link de compra.' },
  // Entrada e Saída do estacionamento são operações diferentes de
  // verdade (registrar carro chegando vs. cobrar/liberar quem sai) —
  // continuam sendo 2 permissões independentes no banco, cada uma
  // marcável na sua própria caixinha, agrupadas visualmente dentro do
  // card "Estacionamento" (não fundidas numa permissão só).
  { value: 'estacionamento_entrada',  label: 'Entrada',              desc: 'Verificar veículo (registro)',
    help: 'Libera a parte de ENTRADA da tela de "Estacionamento" — registrar placa/modelo/cor do carro que está chegando. Sozinha, não deixa registrar saída nem cobrar.' },
  { value: 'estacionamento_saida',    label: 'Saída',                desc: 'Caixa — cobrar e liberar',
    help: 'Libera a parte de SAÍDA da tela de "Estacionamento" — dar baixa no carro e cobrar o valor (se o local for pago). Sozinha, não deixa registrar entrada.' },
  { value: 'autorizar_sangria',       label: 'Autorizar sangria',    desc: 'Confirmar retirada de dinheiro de um caixa',
    help: 'Permite que ESSA função autorize a sangria (retirada parcial de dinheiro) de qualquer caixa do evento, digitando o PIN dela na hora — quem opera a tela não precisa ser a mesma pessoa que retira o dinheiro.' },
  { value: 'ver_lista_convidados',    label: 'Ver lista',            desc: 'Lista de compradores',
    help: 'Libera a tela com a lista de quem comprou ingresso pro evento (nome, ingresso, se já entrou) — só consulta, não deixa vender nem escanear.' },
  { value: 'ver_relatorios',          label: 'Ver relatórios',       desc: 'Vendas e presença',
    help: 'Libera o dashboard de vendas/presença do evento (quanto vendeu, quantos entraram, por forma de pagamento) — visão gerencial, não operacional.' },
  { value: 'gerenciar_checkin',       label: 'Gerenciar check-in',   desc: 'Controlar entrada/saída',
    help: 'Permite marcar manualmente entrada/saída de convidados direto na lista, sem precisar escanear o QR — útil quando o ingresso não tem QR ou o scanner falhou.' },
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

// ── Agrupamento por LOCAL ────────────────────────────────────────────────
//
// Cada card é um LOCAL onde a equipe trabalha (Bilheteria, Portaria,
// Estacionamento — futuro: Praça de Alimentação) e dentro dele ficam os
// atributos que ela pode ter ali (Caixa, Scanner, Entrada, Saída). Fonte
// única — usado tanto no seletor por evento (`PainelEquipe.tsx`) quanto
// nos modelos de função reutilizáveis do admin (`FuncoesClient.tsx`), que
// antes tinha sua própria grade solta, sem agrupamento nenhum.
export const MODULOS: { id: string; label: string; icon: LucideIcon; pontos: string[] }[] = [
  { id: 'bilheteria',     label: 'Bilheteria',     icon: Wallet,     pontos: ['vender_ingresso'] },
  { id: 'portaria',       label: 'Portaria',       icon: ScanQrCode, pontos: ['validar_ingresso'] },
  { id: 'estacionamento', label: 'Estacionamento', icon: Car,        pontos: ['estacionamento_entrada', 'estacionamento_saida'] },
]
// Permissões transversais, que não pertencem a um local físico — ficam
// soltas embaixo dos cards de local.
export const EXTRAS = ['autorizar_sangria', 'ver_lista_convidados', 'ver_relatorios', 'gerenciar_checkin']
// Permissões que tornam relevante escolher um portão específico pro membro.
export const PERMISSOES_ESTACIONAMENTO = ['estacionamento_entrada', 'estacionamento_saida']

export function SeletorPermissoesAgrupado({
  selecionadas,
  onChange,
  // Permissões de estacionamento só aparecem se o evento tiver
  // estacionamento configurado — é um produto à parte. Sem pátio
  // cadastrado, nem faz sentido atribuir. Nos modelos de função do admin
  // (não presos a 1 evento específico) não tem esse gatilho — fica sempre
  // visível, por isso o default `true`.
  temEstacionamento = true,
}: {
  selecionadas: string[]
  onChange: (p: string[]) => void
  temEstacionamento?: boolean
}) {
  // Cada card aberto de cara se já tiver algum atributo dele marcado (ex:
  // editando uma função que já vende na Bilheteria) — senão começa fechado.
  const [modulosAbertos, setModulosAbertos] = useState<Record<string, boolean>>(() => {
    const inicial: Record<string, boolean> = {}
    for (const m of MODULOS) inicial[m.id] = m.pontos.some(v => selecionadas.includes(v))
    return inicial
  })

  function toggle(value: string) {
    onChange(
      selecionadas.includes(value)
        ? selecionadas.filter(p => p !== value)
        : [...selecionadas, value]
    )
  }

  const visivel = (v: string) => temEstacionamento || !PERMISSOES_ESTACIONAMENTO.includes(v)

  const extras = EXTRAS
    .map(v => PERMISSOES_INFO.find(p => p.value === v))
    .filter((p): p is PermissaoInfo => !!p && visivel(p.value))

  return (
    <div className="flex flex-col gap-1.5">
      {MODULOS.map(modulo => {
        const pontos = modulo.pontos
          .map(v => PERMISSOES_INFO.find(p => p.value === v))
          .filter((p): p is PermissaoInfo => !!p && visivel(p.value))
        // Ex: card Estacionamento some inteiro se estiver oculto por falta
        // de pátio cadastrado no evento — os 2 atributos dele são
        // permissões de estacionamento.
        if (pontos.length === 0) return null

        const Icon = modulo.icon
        const aberto = modulosAbertos[modulo.id] ?? false
        const qtdMarcada = pontos.filter(p => selecionadas.includes(p.value)).length

        return (
          <div key={modulo.id} className="rounded-xl overflow-hidden" style={{ border: '1px solid #1e1e1e' }}>
            <button
              type="button"
              onClick={() => setModulosAbertos(s => ({ ...s, [modulo.id]: !s[modulo.id] }))}
              className="w-full flex items-center justify-between px-2.5 py-2 transition-colors"
              style={{ background: '#0d0d0d' }}
            >
              <div className="flex items-center gap-1.5">
                <Icon size={12} style={{ color: ACCENT }} />
                <span className="text-white text-[11px] font-medium" style={{ fontFamily: 'var(--font-dm-sans)' }}>
                  {modulo.label}
                </span>
                {qtdMarcada > 0 && (
                  <span
                    className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full"
                    style={{ background: `${ACCENT}20`, color: ACCENT, fontFamily: 'var(--font-dm-sans)' }}
                  >
                    {qtdMarcada}
                  </span>
                )}
              </div>
              {aberto ? <ChevronUp size={13} className="text-[#555]" /> : <ChevronDown size={13} className="text-[#555]" />}
            </button>
            {aberto && (
              <div className={`grid gap-1.5 p-2 pt-0 ${pontos.length > 1 ? 'grid-cols-2' : 'grid-cols-1'}`} style={{ background: '#0a0a0a' }}>
                {pontos.map(p => (
                  <BotaoPermissao key={p.value} p={p} marcada={selecionadas.includes(p.value)} onClick={() => toggle(p.value)} />
                ))}
              </div>
            )}
          </div>
        )
      })}

      <div className="grid grid-cols-2 gap-1.5">
        {extras.map(p => (
          <BotaoPermissao key={p.value} p={p} marcada={selecionadas.includes(p.value)} onClick={() => toggle(p.value)} />
        ))}
      </div>
    </div>
  )
}
