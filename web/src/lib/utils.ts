// Função utilitária para combinar classes CSS do Tailwind sem conflitos
// Uso: cn('text-red-500', condicao && 'font-bold', 'mt-4')
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
