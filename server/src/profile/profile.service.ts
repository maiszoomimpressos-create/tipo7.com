import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { AutosaveService, type AutosaveVehicleFull } from '../common/autosave.service';
import { apenasDigitos } from '../common/document-validation.util';
import { PrismaService } from '../prisma/prisma.service';

// Mesmo padrão de webhooks.service.ts (isUniqueConstraintError) — detecta
// violação de índice único do Postgres (P2002) sem depender do texto do erro.
function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// Achado real (08/08/2026, follow-up do fix original): `err.meta.target`
// (o caminho "clássico" do Prisma) vem VAZIO neste projeto, porque o server
// usa o driver adapter do pg (`@prisma/adapter-pg` — ver log de boot
// "Conectado ao Postgres via Prisma (driver adapter pg)"), que reporta o
// nome da coluna em `err.meta.driverAdapterError.cause.constraint.fields`
// em vez de `err.meta.target`. Sem isso, a mensagem sempre caía no genérico
// "Um dos dados informados já está em uso" — o usuário salvando telefone+CPF
// juntos não tinha como saber qual dos dois era o problema de verdade.
// Tenta os 3 caminhos possíveis, do mais específico ao mais genérico
// (o 3º usa `err.message`, que o Prisma sempre formata com o nome do campo
// entre crases — "Unique constraint failed on the fields: (`phone`)" —
// então funciona mesmo se a forma interna do driver adapter mudar de novo).
function camposUnicosViolados(err: Prisma.PrismaClientKnownRequestError): string[] {
  const target = err.meta?.target;
  if (Array.isArray(target)) return target as string[];
  if (typeof target === 'string') return [target];

  const viaAdapter = (err.meta as Record<string, unknown> | undefined)?.driverAdapterError as
    | { cause?: { constraint?: { fields?: string[] } } }
    | undefined;
  const camposAdapter = viaAdapter?.cause?.constraint?.fields;
  if (Array.isArray(camposAdapter)) return camposAdapter;

  const match = err.message.match(/fields:\s*\(([^)]+)\)/);
  if (match) return match[1].split(',').map((s) => s.trim().replace(/`/g, ''));

  return [];
}

// Nome amigável por campo — a coluna que colidiu (ex: 'phone') não é o nome
// que o usuário reconhece.
const CAMPO_LABEL: Record<string, string> = {
  phone: 'Esse telefone já está cadastrado em outra conta.',
  cpf: 'Esse CPF já está cadastrado em outra conta.',
  email: 'Esse email já está cadastrado em outra conta.',
};

// Porte de web/src/app/perfil/ProfileForm.tsx e outros ~9 arquivos que
// liam/escreviam a tabela profiles direto (Fase 7.2, grupo G2).
@Injectable()
export class ProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly autosave: AutosaveService,
  ) {}

  // Resposta em snake_case — minimiza o diff nos vários consumidores que
  // hoje leem direto do Supabase (mesmo padrão do getEventoCore, Fase 7.1-b).
  async getProfile(userId: string) {
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: {
        fullName: true, phone: true, cpf: true, rg: true, birthDate: true, avatarUrl: true,
        zipCode: true, street: true, streetNumber: true, neighborhood: true, city: true,
        state: true, addressType: true, complement: true, createdAt: true, userCode: true, email: true,
      },
    });
    if (!profile) throw new NotFoundException('Perfil não encontrado');

    return {
      full_name: profile.fullName,
      phone: profile.phone,
      cpf: profile.cpf,
      rg: profile.rg,
      // birthDate é uma coluna @db.Date (só data, sem hora) — .toISOString()
      // devolve timestamp completo ("1981-04-02T00:00:00.000Z"), que quebra
      // o parser ingênuo do front (isoToDisplay faz iso.split('-'), assumindo
      // "AAAA-MM-DD" puro). Corta pra só os 10 primeiros caracteres.
      birth_date: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      avatar_url: profile.avatarUrl,
      zip_code: profile.zipCode,
      street: profile.street,
      street_number: profile.streetNumber,
      neighborhood: profile.neighborhood,
      city: profile.city,
      state: profile.state,
      address_type: profile.addressType,
      complement: profile.complement,
      created_at: profile.createdAt.toISOString(),
      user_code: profile.userCode,
      email: profile.email,
    };
  }

  async atualizarProfile(
    userId: string,
    body: {
      fullName?: string; phone?: string | null; cpf?: string | null; rg?: string | null;
      birthDate?: string | null; avatarUrl?: string | null;
      zipCode?: string | null; street?: string | null; streetNumber?: string | null;
      neighborhood?: string | null; city?: string | null; state?: string | null;
      addressType?: string | null; complement?: string | null;
    },
  ) {
    try {
      await this.prisma.profile.update({
        where: { id: userId },
        data: {
          ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
          // Máscara é só do front — aqui sempre grava só dígitos (ou null),
          // nunca o que o body mandou cru. Ver apenasDigitos().
          ...(body.phone !== undefined ? { phone: body.phone ? apenasDigitos(body.phone) : null } : {}),
          ...(body.cpf !== undefined ? { cpf: body.cpf ? apenasDigitos(body.cpf) : null } : {}),
          ...(body.rg !== undefined ? { rg: body.rg } : {}),
          ...(body.birthDate !== undefined ? { birthDate: body.birthDate ? new Date(body.birthDate) : null } : {}),
          ...(body.avatarUrl !== undefined ? { avatarUrl: body.avatarUrl } : {}),
          ...(body.zipCode !== undefined ? { zipCode: body.zipCode } : {}),
          ...(body.street !== undefined ? { street: body.street } : {}),
          ...(body.streetNumber !== undefined ? { streetNumber: body.streetNumber } : {}),
          ...(body.neighborhood !== undefined ? { neighborhood: body.neighborhood } : {}),
          ...(body.city !== undefined ? { city: body.city } : {}),
          ...(body.state !== undefined ? { state: body.state } : {}),
          ...(body.addressType !== undefined ? { addressType: body.addressType } : {}),
          ...(body.complement !== undefined ? { complement: body.complement } : {}),
        },
      });
    } catch (err) {
      // Achado real (08/08/2026): phone/cpf/email são @unique na tabela —
      // salvar um telefone que já pertence a outra conta estourava 500 cru,
      // e o front só sabia mostrar "Erro ao salvar. Tente novamente." sem
      // explicar o motivo. Devolve 409 com mensagem específica do campo.
      if (isUniqueConstraintError(err)) {
        const alvo = camposUnicosViolados(err);
        const campo = alvo.find((c) => c in CAMPO_LABEL);
        throw new ConflictException(campo ? CAMPO_LABEL[campo] : 'Um dos dados informados já está em uso em outra conta.');
      }
      throw err;
    }

    return { ok: true };
  }

  // POST /profile/veiculo — aba "Veículo" em /perfil (08/08/2026). Não
  // grava nada em tabela própria do Tipo7 — só normaliza e repassa pra
  // Autosave (fonte única de verdade dos veículos, decisão do usuário).
  // `type`/`status` são enum fixo do lado deles, valores ainda não
  // confirmados — mandados como texto livre por enquanto; se a Autosave
  // rejeitar, o erro dela é repassado pro usuário tal como veio.
  async salvarVeiculo(userId: string, body: Record<string, unknown>) {
    const placa = typeof body.plate === 'string' ? body.plate.trim().toUpperCase() : '';
    if (!placa) throw new BadRequestException('Placa é obrigatória.');

    const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : undefined);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);

    const dados: AutosaveVehicleFull = {
      plate: placa,
      name: str(body.name),
      type: str(body.type),
      brand: str(body.brand),
      model: str(body.model),
      year: num(body.year),
      color: str(body.color),
      status: str(body.status),
      category: str(body.category),
      species: str(body.species),
      body_type: str(body.body_type),
      chassis_number: str(body.chassis_number),
      renavam: str(body.renavam),
      engine_number: str(body.engine_number),
      security_code: str(body.security_code),
      license_expiry: str(body.license_expiry),
      licensing_year: num(body.licensing_year),
      restrictions: str(body.restrictions),
      odometer_km: num(body.odometer_km),
      fuel_type: str(body.fuel_type),
      capacity: num(body.capacity),
      power_cv: num(body.power_cv),
      displacement: str(body.displacement),
      cmt: str(body.cmt),
      axles: num(body.axles),
      owner_name: str(body.owner_name),
      owner_document: typeof body.owner_document === 'string' && body.owner_document.trim() ? apenasDigitos(body.owner_document) : undefined,
      driver_phone: typeof body.driver_phone === 'string' && body.driver_phone.trim() ? apenasDigitos(body.driver_phone) : undefined,
      city: str(body.city),
      state: str(body.state),
      notes: str(body.notes),
    };

    const resultado = await this.autosave.criarOuAtualizarVeiculo(dados);
    if (!resultado.ok) {
      // Achado real (08/08/2026): devolver 502/503 pro cliente aqui fazia
      // a EasyPanel/Traefik interceptar a resposta e trocar o corpo pela
      // página genérica deles ("Service is not reachable") — a mensagem de
      // erro de verdade (ex: "invalid input value for enum vehicle_type")
      // nunca chegava no usuário, e nem log nosso mostrava nada (o
      // logger.warn no autosave.service.ts já resolve a parte de log).
      // 400 sempre, com a mensagem real da Autosave — não é problema de
      // rede/infra do ponto de vista de quem preenche o formulário.
      throw new BadRequestException(resultado.message);
    }

    return { vehicle: resultado.vehicle, created: resultado.created };
  }
}
