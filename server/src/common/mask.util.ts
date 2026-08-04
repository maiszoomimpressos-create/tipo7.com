// Porte 1:1 de web/src/lib/mask.ts.
export function maskPhone(phone: string): string {
  const d = phone.replace(/\D/g, '');
  if (d.length < 6) return '****';
  const ddd = d.slice(0, 2);
  const ultimos = d.slice(-4);
  return `(${ddd}) 9****-${ultimos}`;
}

export function maskEmail(email: string): string {
  const [local, dominio] = email.split('@');
  if (!dominio) return '****';
  const primeiraLetraLocal = local[0] ?? '*';
  const partesDominio = dominio.split('.');
  const primeiraLetraDominio = partesDominio[0]?.[0] ?? '*';
  const sufixo = partesDominio.slice(1).join('.');
  return `${primeiraLetraLocal}***@${primeiraLetraDominio}***${sufixo ? '.' + sufixo : ''}`;
}
