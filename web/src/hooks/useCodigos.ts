'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { useAuth } from '@/contexts/AuthContext'

export interface CodigoItem {
  codigo: string
  tipo:   'usuario' | 'promotora' | 'estabelecimento'
}

interface OrgRow {
  codigo: string | null
  type:   string
  status: string
}

export function useCodigos(): CodigoItem[] {
  const { user } = useAuth()
  const [codigos, setCodigos] = useState<CodigoItem[]>([])

  useEffect(() => {
    if (!user) { setCodigos([]); return }

    async function carregar() {
      const lista: CodigoItem[] = []

      const profileRes = await apiFetchAuth('/api/profile')
      const profile = profileRes.ok ? await profileRes.json() as { user_code: string | null } : null

      if (profile?.user_code) {
        lista.push({ codigo: profile.user_code, tipo: 'usuario' })
      }

      // Organizações que o usuário administra — dono integral ou sócio, só
      // as ATIVAS (convite pendente não aparece aqui, some só depois que a
      // pessoa aceita — organization_admins.status='ativo' é a mesma trava
      // que o is_org_admin() do banco já exige pra dar acesso de verdade).
      const orgsRes = await apiFetchAuth('/api/organizations')
      const orgsData = orgsRes.ok ? await orgsRes.json() as { organizacoes: OrgRow[] } : null

      for (const org of orgsData?.organizacoes ?? []) {
        if (org?.codigo && org.type === 'promotora' && org.status === 'ativo') {
          lista.push({ codigo: org.codigo, tipo: 'promotora' })
        }
      }

      // Lugares administrados (venue_admins) — "estabelecimento" não é mais organização
      const venuesRes = await apiFetchAuth('/api/venues/minhas')
      const venuesData = venuesRes.ok ? await venuesRes.json() as { venues: { codigo: string | null }[] } : null

      for (const v of venuesData?.venues ?? []) {
        if (v.codigo) lista.push({ codigo: v.codigo, tipo: 'estabelecimento' })
      }

      setCodigos(lista)
    }

    carregar()
  }, [user])

  return codigos
}
