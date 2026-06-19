'use client'

// Componente que agrupa todos os Providers da aplicação
// Precisa ser client component para poder usar contextos que dependem de estado
// Importado pelo layout.tsx (server component) como uma camada de client boundary
import { AuthProvider } from '@/contexts/AuthContext'
import { ProfileCompletionModal } from './ProfileCompletionModal'
import { type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
  return (
    <AuthProvider>
      {children}
      {/* Modal progressivo — aparece uma vez por sessão se endereço estiver incompleto */}
      <ProfileCompletionModal />
    </AuthProvider>
  )
}
