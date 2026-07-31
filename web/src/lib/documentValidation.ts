// Validação de CPF/CNPJ — usado no servidor (rotas de organizations) pra
// nunca confiar só na validação do client.

export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '')
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false
  let s = 0
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i)
  let r = (s * 10) % 11; if (r >= 10) r = 0
  if (r !== +d[9]) return false
  s = 0
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i)
  r = (s * 10) % 11; if (r >= 10) r = 0
  return r === +d[10]
}

export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '')
  if (d.length !== 14) return false
  if (/^(\d)\1+$/.test(d)) return false
  const calc = (s: string, len: number) => {
    let sum = 0, pos = len - 7
    for (let i = len; i >= 1; i--) {
      sum += parseInt(s[len - i]) * pos--
      if (pos < 2) pos = 9
    }
    const r = sum % 11 < 2 ? 0 : 11 - (sum % 11)
    return r
  }
  return calc(d, 12) === parseInt(d[12]) && calc(d, 13) === parseInt(d[13])
}

// Auto-detecta CPF (11 dígitos) vs CNPJ (14 dígitos) a partir de um campo
// único de documento — não precisa perguntar PF ou PJ, o tamanho já diz.
export function detectarTipoDocumento(documento: string): 'cpf' | 'cnpj' | 'invalido' | 'vazio' {
  const d = documento.replace(/\D/g, '')
  if (!d) return 'vazio'
  if (d.length === 11) return validarCPF(d) ? 'cpf' : 'invalido'
  if (d.length === 14) return validarCNPJ(d) ? 'cnpj' : 'invalido'
  return 'invalido'
}
