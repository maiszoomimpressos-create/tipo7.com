'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

interface TrabalhosStatus {
  pendentes: number
  carregando: boolean
}

export function useTrabalhos(): TrabalhosStatus {
  const { user } = useAuth()
  const supabase = createClient()

  const [pendentes,  setPendentes]  = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user) { setCarregando(false); return }

    supabase
      .from('event_staff')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'pending')
      .then(({ count }) => {
        setPendentes(count ?? 0)
        setCarregando(false)
      })
  }, [user])

  return { pendentes, carregando }
}
