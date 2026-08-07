'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { useAuth } from '@/contexts/AuthContext'

interface OrganizacaoConvitesStatus {
  pendentes:  number
  carregando: boolean
}

// Convites pra administrar uma organização (proprietário integral ou
// sócio) ainda não respondidos — mesmo padrão do useTrabalhos.ts.
export function useOrganizacaoConvites(): OrganizacaoConvitesStatus {
  const { user } = useAuth()

  const [pendentes,  setPendentes]  = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user) { setCarregando(false); return }

    apiFetchAuth('/api/organizations')
      .then(res => res.ok ? res.json() : null)
      .then((data: { organizacoes: { status: string }[] } | null) => {
        const count = (data?.organizacoes ?? []).filter(o => o.status === 'convidado').length
        setPendentes(count)
        setCarregando(false)
      })
  }, [user])

  return { pendentes, carregando }
}
