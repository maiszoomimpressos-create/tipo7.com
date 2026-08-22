// Registro de ícones do Tutorial de evento (22/08/2026) — conteúdo editável
// em Admin > Conteúdo > Tutorial de evento, mas o ícone de cada passo só
// pode vir desse conjunto fixo (evita salvar uma string qualquer que não
// bate com nenhum ícone real). Usado tanto pelo editor (admin/conteudo/
// ConteudoClient.tsx, <select>) quanto pelo modal que exibe pro usuário
// final (components/TutorialModal.tsx).
import {
  Layers, Ticket, Users, Car, Settings, ShoppingBag, BarChart2,
  Sparkles, CreditCard, ScanQrCode, MapPin, Megaphone, ClipboardList,
  type LucideIcon,
} from 'lucide-react'

export const TUTORIAL_ICONES: Record<string, LucideIcon> = {
  Layers, Ticket, Users, Car, Settings, ShoppingBag, BarChart2,
  Sparkles, CreditCard, ScanQrCode, MapPin, Megaphone, ClipboardList,
}

export const TUTORIAL_ICONE_KEYS = Object.keys(TUTORIAL_ICONES)

export interface TutorialPasso {
  titulo: string
  texto:  string
  icone:  string
}

export const TUTORIAL_PASSOS_PADRAO: TutorialPasso[] = [
  {
    icone: 'Layers',
    titulo: 'Estrutura',
    texto: 'Comece por aqui: nome do evento, data, local, banner e — se o evento tiver mais de um dia — os dias específicos.',
  },
  {
    icone: 'Ticket',
    titulo: 'Ingressos',
    texto: 'Crie os tipos de ingresso (Pista, VIP, Camarote...) com preço e quantidade disponível. Dá pra configurar lotes de preço progressivo dentro do mesmo ingresso, se quiser.',
  },
  {
    icone: 'Users',
    titulo: 'Equipe',
    texto: 'Convide quem vai te ajudar no dia do evento e defina a função de cada um (Scanner, Caixa, Estacionamento...) — a função decide o que a pessoa pode acessar.',
  },
  {
    icone: 'ShoppingBag',
    titulo: 'Bilheteria (caixas)',
    texto: 'No dia do evento, abra os caixas aqui pra vender ingresso presencialmente (dinheiro, PIX ou cartão) e controlar o troco.',
  },
  {
    icone: 'Car',
    titulo: 'Estacionamento',
    texto: 'Se o local do evento tiver estacionamento, configure aqui: preço, quantidade de vagas e portões de entrada/saída. Só use se fizer sentido pro seu evento.',
  },
  {
    icone: 'Settings',
    titulo: 'Configurações',
    texto: 'Ajustes do evento: pausar vendas online automaticamente perto da data, encerrar ou adiar o evento.',
  },
  {
    icone: 'BarChart2',
    titulo: 'Relatórios',
    texto: 'Acompanhe vendas e presença em tempo real, a qualquer momento antes ou durante o evento.',
  },
]
