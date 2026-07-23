'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function desconectarContaMP() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('promotor_mp_accounts')
    .delete()
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/contas')
}

export async function desconectarContaPagBank() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Não autenticado')

  const { error } = await supabase
    .from('promotor_pagbank_accounts')
    .delete()
    .eq('user_id', user.id)

  if (error) throw new Error(error.message)
  revalidatePath('/configuracoes/contas')
}
