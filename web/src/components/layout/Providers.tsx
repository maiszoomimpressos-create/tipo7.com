'use client'

// Componente que agrupa todos os Providers da aplicação
// Precisa ser client component para poder usar contextos que dependem de estado
// Importado pelo layout.tsx (server component) como uma camada de client boundary
import { AuthProvider } from '@/contexts/AuthContext'
import { LocationProvider } from '@/contexts/LocationContext'
import { ProfileCompletionModal } from './ProfileCompletionModal'
import { type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      <LocationProvider>
        {children}
        {/* Modal progressivo — aparece uma vez por sessão se endereço estiver incompleto */}
        <ProfileCompletionModal />
      </LocationProvider>
    </AuthProvider>
  )
}
