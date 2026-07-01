// Executa todos os testes de estresse em sequência
import { execSync } from 'child_process'
import { join, dirname } from 'path'
import { fileURLToPath } from 'url'

const dir = dirname(fileURLToPath(import.meta.url))

const TESTES = [
  '01-carga-geral.mjs',
  '02-scanner-race.mjs',
  '03-checkout-race.mjs',
  '04-rate-limit.mjs',
]

console.log('\n' + '█'.repeat(60))
console.log('  TIPO7 — SUÍTE DE TESTES DE ESTRESSE')
console.log('  ' + new Date().toLocaleString('pt-BR'))
console.log('█'.repeat(60))

for (const teste of TESTES) {
  console.log('\n\n')
  try {
    execSync(`node "${join(dir, teste)}"`, { stdio: 'inherit' })
  } catch {
    // execSync lança se o processo sair com código != 0, mas queremos continuar
  }
}

console.log('\n\n' + '█'.repeat(60))
console.log('  TODOS OS TESTES CONCLUÍDOS')
console.log('█'.repeat(60) + '\n')
