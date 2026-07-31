'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/contexts/AuthContext'

interface OrganizacaoConvitesStatus {
  pendentes:  number
  carregando: boolean
}

// Convites pra administrar uma organização (proprietário integral ou
// sócio) ainda não respondidos — mesmo padrão do useTrabalhos.ts.
export function useOrganizacaoConvites(): OrganizacaoConvitesStatus {
  const { user } = useAuth()
  const supabase = createClient()

  const [pendentes,  setPendentes]  = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user) { setCarregando(false); return }

    supabase
      .from('organization_admins')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .eq('status', 'convidado')
      .then(({ count }) => {
        setPendentes(count ?? 0)
        setCarregando(false)
      })
  }, [user])

  return { pendentes, carregando }
}
