'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
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

      const { data: profile } = await supabase
        .from('profiles')
        .select('user_code')
        .eq('id', user!.id)
        .single()

      if (profile?.user_code) {
        lista.push({ codigo: profile.user_code, tipo: 'usuario' })
      }

      const { data: orgs } = await supabase
        .from('organizations')
        .select('codigo, type')
        .eq('owner_id', user!.id)
        .not('codigo', 'is', null)

      for (const org of orgs ?? []) {
        lista.push({
          codigo: org.codigo!,
          tipo:   org.type as 'promotora' | 'estabelecimento',
        })
      }

      setCodigos(lista)
    }

    carregar()
  }, [user])

  return codigos
}
