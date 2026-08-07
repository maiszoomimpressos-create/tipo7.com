'use server'

import { getAuthUser } from '@/lib/auth/server'
import { apiFetchServer } from '@/lib/apiFetchServer'
import { revalidatePath } from 'next/cache'

export async function desconectarContaMP() {
  const user = await getAuthUser()
  if (!user) throw new Error('Não autenticado')

  const res = await apiFetchServer('/api/mp/disconnect', { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desconectar conta Mercado Pago')
  revalidatePath('/configuracoes/contas')
}

export async function desconectarContaPagBank() {
  const user = await getAuthUser()
  if (!user) throw new Error('Não autenticado')

  const res = await apiFetchServer('/api/pagbank/disconnect', { method: 'DELETE' })
  if (!res.ok) throw new Error('Falha ao desconectar conta PagBank')
  revalidatePath('/configuracoes/contas')
}
