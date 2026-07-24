'use server'

import { updateTag } from 'next/cache'

// Força a lista de usuários (cacheada por 1 min em page.tsx) a buscar dados
// novos no próximo carregamento — usado pelo botão "Atualizar" da tela.
// updateTag expira na hora (sem stale-while-revalidate), pra quem clicou
// ver o resultado fresco imediatamente.
export async function atualizarUsuarios() {
  updateTag('admin-usuarios')
}
