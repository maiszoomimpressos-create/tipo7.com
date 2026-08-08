// Achado real (08/08/2026): CPF/telefone/CNPJ eram gravados no banco do
// jeito que chegassem no body — às vezes com máscara (pontos/traço/
// parênteses), às vezes sem. Como as colunas são @unique e o Postgres
// compara texto puro, "456.123.789-55" e "45612378955" são duas strings
// DIFERENTES pro banco, mesmo sendo o mesmo CPF na vida real — a trava de
// unicidade não pega esse caso, permitindo duas contas com o "mesmo" dado.
// Regra do projeto a partir de agora: máscara só existe na exibição do
// front — todo write no banco usa isso aqui antes de gravar, não importa
// o que o body mandou.
export function apenasDigitos(v: string): string {
  return v.replace(/\D/g, '');
}

// Porte 1:1 de web/src/lib/documentValidation.ts.
export function validarCPF(cpf: string): boolean {
  const d = cpf.replace(/\D/g, '');
  if (d.length !== 11 || /^(\d)\1+$/.test(d)) return false;
  let s = 0;
  for (let i = 0; i < 9; i++) s += +d[i] * (10 - i);
  let r = (s * 10) % 11;
  if (r >= 10) r = 0;
  if (r !== +d[9]) return false;
  s = 0;
  for (let i = 0; i < 10; i++) s += +d[i] * (11 - i);
  r = (s * 10) % 11;
  if (r >= 10) r = 0;
  return r === +d[10];
}

export function validarCNPJ(cnpj: string): boolean {
  const d = cnpj.replace(/\D/g, '');
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (s: string, len: number) => {
    let sum = 0;
    let pos = len - 7;
    for (let i = len; i >= 1; i--) {
      sum += parseInt(s[len - i], 10) * pos--;
      if (pos < 2) pos = 9;
    }
    return sum % 11 < 2 ? 0 : 11 - (sum % 11);
  };
  return calc(d, 12) === parseInt(d[12], 10) && calc(d, 13) === parseInt(d[13], 10);
}
