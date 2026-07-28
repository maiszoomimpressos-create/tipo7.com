import { redirect } from 'next/navigation'

// "Tarifas" agora é só a categoria — o conteúdo de cada canal de venda
// (Ingressos on-line, Bilheteria, Tenda) mora nas próprias subpáginas.
export default function FinanceiroPage() {
  redirect('/admin/financeiro/ingressos-online')
}
