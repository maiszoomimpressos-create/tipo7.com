'use client'

export function SecaoBloqueavel({
  ativo,
  children,
  mensagem = 'Preencha o campo acima primeiro',
}: {
  ativo: boolean
  children: React.ReactNode
  mensagem?: string
}) {
  return (
    <div className="relative">
      <div className={ativo ? '' : 'opacity-40 pointer-events-none select-none'}>
        {children}
      </div>
      {!ativo && (
        <p className="mt-1 text-[11px] text-[#666]" style={{ fontFamily: 'var(--font-dm-sans)' }}>
          🔒 {mensagem}
        </p>
      )}
    </div>
  )
}
