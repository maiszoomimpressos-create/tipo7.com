'use client'

import { useEffect, useState } from 'react'
import { apiFetchAuth } from '@/lib/apiFetch'
import { useAuth } from '@/contexts/AuthContext'

interface TrabalhosStatus {
  pendentes: number
  carregando: boolean
}

export function useTrabalhos(): TrabalhosStatus {
  const { user } = useAuth()

  const [pendentes,  setPendentes]  = useState(0)
  const [carregando, setCarregando] = useState(true)

  useEffect(() => {
    if (!user) { setCarregando(false); return }

    apiFetchAuth('/api/trabalhos')
      .then(res => res.ok ? res.json() : { staff: [] })
      .then((data: { staff: { status: string }[] }) => {
        setPendentes((data.staff ?? []).filter(s => s.status === 'pending').length)
        setCarregando(false)
      })
  }, [user])

  return { pendentes, carregando }
}
