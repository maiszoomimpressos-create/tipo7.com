import { CaixaLoginClient } from './CaixaLoginClient'

export const metadata = {
  title: 'Acesso ao caixa — Tipo7',
}

// Rota pública de propósito — sem checagem de sessão aqui. É a URL fixa
// salva no PC compartilhado do balcão / configurada na maquininha, cujo
// único jeito de entrar é digitar token+PIN (ver CaixaLoginClient).
export default function CaixaPage() {
  return <CaixaLoginClient />
}
