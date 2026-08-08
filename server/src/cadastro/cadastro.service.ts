import { Injectable } from '@nestjs/common';
import { AutosaveService } from '../common/autosave.service';
import { apenasDigitos } from '../common/document-validation.util';
import { maskEmail, maskPhone } from '../common/mask.util';
import { PrismaService } from '../prisma/prisma.service';

function cpfValido(cpf: string): boolean {
  if (/^(\d)\1{10}$/.test(cpf)) return false;
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += parseInt(cpf[i], 10) * (10 - i);
  let d1 = 11 - (sum % 11);
  if (d1 >= 10) d1 = 0;
  if (d1 !== parseInt(cpf[9], 10)) return false;
  sum = 0;
  for (let i = 0; i < 10; i++) sum += parseInt(cpf[i], 10) * (11 - i);
  let d2 = 11 - (sum % 11);
  if (d2 >= 10) d2 = 0;
  return d2 === parseInt(cpf[10], 10);
}

function normalizarTelefone(v: string): string {
  return v.replace(/\D/g, '');
}

function normalizarEmail(v: string): string {
  return v.trim().toLowerCase();
}

// Porte 1:1 de web/src/app/api/auth/{cpf-lookup,cpf-confirmar,sync-autosave}/route.ts.
@Injectable()
export class CadastroService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autosave: AutosaveService,
  ) {}

  // Nunca devolve dado bruto — só uma dica mascarada de telefone/email, pra
  // depois exigir confirmação (cpfConfirmar) antes de liberar o
  // preenchimento automático.
  async cpfLookup(cpfRaw: string | undefined) {
    const cpfLimpo = cpfRaw?.replace(/\D/g, '') ?? '';
    if (cpfLimpo.length !== 11 || !cpfValido(cpfLimpo)) return { found: false };

    const cliente = await this.autosave.buscarClientePorCpf(cpfLimpo);
    if (!cliente || (!cliente.phone && !cliente.email)) return { found: false };

    return {
      found: true,
      telefoneMascarado: cliente.phone ? maskPhone(cliente.phone) : null,
      emailMascarado: cliente.email ? maskEmail(cliente.email) : null,
    };
  }

  // "valor" é o telefone ou email completo que a pessoa digitou pra provar
  // que conhece um dado privado do cadastro encontrado (não só o CPF, que
  // sozinho não é segredo suficiente).
  async cpfConfirmar(cpfRaw: string | undefined, valor: string | undefined) {
    const cpfLimpo = cpfRaw?.replace(/\D/g, '') ?? '';
    if (cpfLimpo.length !== 11 || !valor?.trim()) return { ok: false };

    const cliente = await this.autosave.buscarClientePorCpf(cpfLimpo);
    if (!cliente) return { ok: false };

    const valorDigitado = valor.trim();
    const bateTelefone = !!cliente.phone && normalizarTelefone(valorDigitado) === normalizarTelefone(cliente.phone);
    const bateEmail = !!cliente.email && normalizarEmail(valorDigitado) === normalizarEmail(cliente.email);

    if (!bateTelefone && !bateEmail) return { ok: false };

    return {
      ok: true,
      dados: {
        fullName: cliente.full_name || null,
        email: cliente.email || null,
        phone: cliente.phone || null,
        birthDate: cliente.birth_date || null,
        rg: cliente.rg || null,
        zipCode: cliente.zip_code || null,
        street: cliente.street || null,
        streetNumber: cliente.street_number || null,
        neighborhood: cliente.neighborhood || null,
        city: cliente.city || null,
        state: cliente.state || null,
        complement: cliente.complement || null,
      },
    };
  }

  // Manda o cadastro atual do usuário logado pra Autosave (best-effort).
  // Não recebe body — sempre lê o profile mais atual direto do banco.
  async syncAutosave(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true, cpf: true, phone: true, rg: true, birthDate: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true,
        city: true, state: true, complement: true,
      },
    });
    if (!profile) return { ok: true };

    const emailRows = await this.prisma.$queryRaw<{ id: string; email: string }[]>`
      SELECT * FROM get_user_emails(ARRAY[${userId}::uuid])
    `;
    const email = emailRows[0]?.email;

    await this.autosave.enviarClienteParaAutosave({
      external_id: userId,
      full_name: profile.fullName ?? undefined,
      email: email ?? undefined,
      // Manda sempre sem máscara pra Autosave, mesmo se o dado salvo aqui
      // ainda estiver sujo (legado) — nunca propaga formatação inconsistente
      // pro sistema externo. Achado real 08/08/2026.
      cpf: profile.cpf ? apenasDigitos(profile.cpf) : undefined,
      phone: profile.phone ? apenasDigitos(profile.phone) : undefined,
      rg: profile.rg ?? undefined,
      // birthDate é @db.Date — mesmo bug já corrigido em profile.service.ts:
      // .toISOString() cru manda timestamp completo pra Autosave, que volta
      // corrompido no autofill de CPF (auth/page.tsx, ProfileForm.tsx).
      // Achado real 08/08/2026.
      birth_date: profile.birthDate?.toISOString().slice(0, 10) ?? undefined,
      zip_code: profile.zipCode ?? undefined,
      street: profile.street ?? undefined,
      street_number: profile.streetNumber ?? undefined,
      neighborhood: profile.neighborhood ?? undefined,
      city: profile.city ?? undefined,
      state: profile.state ?? undefined,
      complement: profile.complement ?? undefined,
    });

    return { ok: true };
  }
}
