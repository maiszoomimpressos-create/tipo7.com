'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { apiFetchAuth } from '@/lib/apiFetch'
import { useAuth } from '@/contexts/AuthContext'

export interface CodigoItem {
  codigo: string
  tipo:   'usuario' | 'promotora' | 'estabelecimento'
}

export function useCodigos(): CodigoItem[] {
  const { user } = useAuth()
  const supabase = createClient()
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
      const { data: orgAdminRows } = await supabase
        .from('organization_admins')
        .select('organizations (codigo, type)')
        .eq('user_id', user!.id)
        .eq('status', 'ativo')

      for (const row of orgAdminRows ?? []) {
        const org = Array.isArray(row.organizations) ? row.organizations[0] : row.organizations
        if (org?.codigo && org.type === 'promotora') {
          lista.push({ codigo: org.codigo, tipo: 'promotora' })
        }
      }

      // Lugares administrados (venue_admins) — "estabelecimento" não é mais organização
      const { data: venueAdmins } = await supabase
        .from('venue_admins')
        .select('venues ( codigo )')
        .eq('user_id', user!.id)
        .eq('status', 'ativo')

      for (const va of venueAdmins ?? []) {
        const venue = Array.isArray(va.venues) ? va.venues[0] : va.venues
        if (venue?.codigo) lista.push({ codigo: venue.codigo, tipo: 'estabelecimento' })
      }

      setCodigos(lista)
    }

    carregar()
  }, [user])

  return codigos
}
