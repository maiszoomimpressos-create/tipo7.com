import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Porte de web/src/app/perfil/ProfileForm.tsx e outros ~9 arquivos que
// liam/escreviam a tabela profiles direto (Fase 7.2, grupo G2).
@Injectable()
export class ProfileService {
  constructor(private readonly prisma: PrismaService) {}

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
      birth_date: profile.birthDate ? profile.birthDate.toISOString() : null,
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
    await this.prisma.profile.update({
      where: { id: userId },
      data: {
        ...(body.fullName !== undefined ? { fullName: body.fullName } : {}),
        ...(body.phone !== undefined ? { phone: body.phone } : {}),
        ...(body.cpf !== undefined ? { cpf: body.cpf } : {}),
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

    return { ok: true };
  }
}
