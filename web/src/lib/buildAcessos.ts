import {
  ShoppingCart, ScanQrCode, ClipboardList, BarChart2, Settings, Car,
} from 'lucide-react'

// Extraído de TrabalhoClient.tsx (Fase A do plano de redirect inteligente,
// ver docs/plano-terminais-caixa-pwa.md) — compartilhado agora entre o hub
// `/trabalho/[eventoId]` (que monta os cards de navegação) e o login por
// token+PIN em `/caixa` (que usa a mesma lista pra decidir se dá pra pular
// direto pra tela, sem passar pelo hub).
export interface AcessoItem {
  perm:  string[]  // basta ter QUALQUER uma dessas permissões
  label: string
  desc:  string
  icon:  React.ElementType
  href:  string
  cor:   string
}

export function buildAcessos(eventoId: string, permissoes: string[], isOwner: boolean): AcessoItem[] {
  const mapa: AcessoItem[] = [
    {
      perm:  ['vender_ingresso'],
      label: 'Bilheteria',
      desc:  'Vender ingressos presencialmente',
      icon:  ShoppingCart,
      href:  `/bilheteria/${eventoId}`,
      cor:   '#E8B84B',
    },
    {
      perm:  ['validar_ingresso'],
      label: 'Scanner',
      desc:  'Escanear e validar ingressos na entrada',
      icon:  ScanQrCode,
      href:  `/scanner/${eventoId}`,
      cor:   '#4ade80',
    },
    {
      perm:  ['ver_lista_convidados'],
      label: 'Lista de compradores',
      desc:  'Ver quem comprou ingresso',
      icon:  ClipboardList,
      href:  `/dashboard/${eventoId}`,
      cor:   '#60a5fa',
    },
    {
      perm:  ['ver_relatorios'],
      label: 'Relatórios',
      desc:  'Vendas e presença do evento',
      icon:  BarChart2,
      href:  `/dashboard/${eventoId}`,
      cor:   '#a78bfa',
    },
    {
      // Basta ter entrada OU saída — a própria tela do estacionamento mostra
      // só a parte que a permissão da pessoa cobre.
      perm:  ['estacionamento_entrada', 'estacionamento_saida'],
      label: 'Estacionamento',
      desc:  'Registrar entrada e/ou saída de veículos',
      icon:  Car,
      href:  `/estacionamento/${eventoId}`,
      cor:   '#38bdf8',
    },
  ]

  if (isOwner) {
    mapa.push({
      perm:  ['gerenciar_equipe'],
      label: 'Painel do evento',
      desc:  'Configurações e gestão completa',
      icon:  Settings,
      href:  `/evento/${eventoId}/gerenciar`,
      cor:   '#888',
    })
  }

  const visiveis = mapa.filter(a => a.perm.some(p => permissoes.includes(p)))
  return visiveis.filter((a, i, arr) => arr.findIndex(b => b.href === a.href) === i)
}
