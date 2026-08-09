import { randomBytes } from 'crypto';
import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '../../generated/prisma/client';
import { apenasDigitos, validarCPF } from '../common/document-validation.util';
import { AutosaveService } from '../common/autosave.service';
import { EmailService } from '../common/email.service';
import { maskEmail, maskPhone } from '../common/mask.util';
import { WhatsAppService } from '../common/whatsapp.service';
import { AuthCoreService } from '../auth-core/auth-core.service';
import { PrismaService } from '../prisma/prisma.service';

function isUniqueConstraintError(err: unknown): boolean {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

// Um select reaproveitado nos 3 lugares que precisam "pedido + slots +
// quem já preencheu" (resumo, preencher com meus dados, reivindicar por link).
const ORDER_COM_SLOTS = {
  select: {
    id: true, userId: true, status: true, eventId: true,
    event: { select: { title: true, dateStart: true, venueName: true, city: true, state: true, bannerUrl: true } },
    orderItems: {
      select: {
        id: true, quantity: true,
        ticket: { select: { name: true } },
        ticketHolders: { select: { slotNumber: true } },
      },
    },
  },
} satisfies Prisma.OrderDefaultArgs;

type OrderComSlots = Prisma.OrderGetPayload<typeof ORDER_COM_SLOTS>;

// Acha o primeiro slot (order_item_id + slot_number) desse pedido que ainda
// não tem ticket_holder — em ordem estável (mesma ordem dos orderItems).
function proximoSlotLivre(order: OrderComSlots): { orderItemId: string; slotNumber: number; ticketName: string } | null {
  for (const item of order.orderItems) {
    const preenchidos = new Set(item.ticketHolders.map((h) => h.slotNumber));
    for (let slot = 1; slot <= item.quantity; slot++) {
      if (!preenchidos.has(slot)) {
        return { orderItemId: item.id, slotNumber: slot, ticketName: item.ticket?.name ?? 'Ingresso' };
      }
    }
  }
  return null;
}

function contarSlots(order: OrderComSlots) {
  const totalSlots = order.orderItems.reduce((acc, i) => acc + i.quantity, 0);
  const filledSlots = order.orderItems.reduce((acc, i) => acc + i.ticketHolders.length, 0);
  return { totalSlots, filledSlots };
}

// Porte gerado 09/08/2026 — pedido do usuário: quando um mesmo comprador
// leva mais de um ingresso pro mesmo evento, em vez de assumir que todos são
// dele, oferecemos ele preencher os demais portadores ou mandar um link
// pra cada pessoa preencher os próprios dados (ver AskUserQuestion desta
// sessão — "pré-cadastro" = conta Tipo7 de verdade, senha aleatória,
// acesso futuro via /auth/recuperar).
@Injectable()
export class HolderLinksService {
  private readonly logger = new Logger(HolderLinksService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly autosave: AutosaveService,
    private readonly whatsapp: WhatsAppService,
    private readonly email: EmailService,
    private readonly authCore: AuthCoreService,
  ) {}

  private async carregarOrderDoDono(userId: string, orderId: string): Promise<OrderComSlots> {
    const order = await this.prisma.order.findUnique({ where: { id: orderId }, ...ORDER_COM_SLOTS });
    if (!order || order.userId !== userId) throw new ForbiddenException('Acesso negado');
    return order;
  }

  // Resumo pra tela de confirmação de pagamento decidir se mostra o
  // assistente (só faz sentido com mais de 1 ingresso do mesmo comprador
  // nesse evento — 1 ingresso sozinho já é resolvido pelo fluxo normal).
  async resumo(userId: string, orderId: string) {
    const order = await this.carregarOrderDoDono(userId, orderId);
    const { totalSlots, filledSlots } = contarSlots(order);

    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { cpf: true } });
    let jaTemIngressoNesseEvento = false;
    if (profile?.cpf) {
      const outro = await this.prisma.ticketHolder.findFirst({
        where: {
          cpf: profile.cpf,
          orderItem: { order: { eventId: order.eventId, id: { not: orderId } } },
        },
        select: { id: true },
      });
      jaTemIngressoNesseEvento = !!outro;
    }

    return {
      event_title: order.event?.title ?? 'Evento',
      total_slots: totalSlots,
      filled_slots: filledSlots,
      ja_tem_ingresso_nesse_evento: jaTemIngressoNesseEvento,
      itens: order.orderItems.map((i) => ({ name: i.ticket?.name ?? 'Ingresso', quantity: i.quantity })),
    };
  }

  // "Um desses é seu?" → preenche o próximo slot livre com o cadastro do
  // próprio comprador (mesmo conjunto de dados do botão "Usar meus dados").
  async preencherComMeusDados(userId: string, orderId: string) {
    const order = await this.carregarOrderDoDono(userId, orderId);
    const profile = await this.prisma.profile.findUnique({
      where: { id: userId },
      select: { fullName: true, cpf: true, email: true, birthDate: true, phone: true },
    });
    if (!profile?.fullName || !profile.cpf || !profile.email || !profile.birthDate) {
      throw new BadRequestException('Complete seu cadastro (nome, CPF, email e nascimento) antes de usar seus dados.');
    }

    const slot = proximoSlotLivre(order);
    if (!slot) throw new BadRequestException('Não há ingressos livres nesse pedido.');

    await this.prisma.ticketHolder.create({
      data: {
        orderItemId: slot.orderItemId,
        slotNumber: slot.slotNumber,
        fullName: profile.fullName,
        cpf: profile.cpf,
        email: profile.email,
        phone: profile.phone,
        birthDate: profile.birthDate,
        userId, // é o próprio comprador — fica editável só por ele mesmo
      },
    });

    return { ok: true, ticket_name: slot.ticketName };
  }

  // Gera (ou reaproveita) o link compartilhável pros slots restantes desse
  // pedido. Um token por pedido — cobre "quantos slots ainda sobrarem",
  // calculado na hora em vez de fixar a lista no momento da criação.
  async criarLink(userId: string, orderId: string) {
    const order = await this.carregarOrderDoDono(userId, orderId);
    if (order.status !== 'approved') throw new BadRequestException('Pedido ainda não foi aprovado.');

    const existente = await this.prisma.holderInviteLink.findFirst({ where: { orderId } });
    if (existente) return { token: existente.token };

    const token = randomBytes(16).toString('hex');
    await this.prisma.holderInviteLink.create({ data: { orderId, token } });
    return { token };
  }

  // Informação pública pra tela do link (sem PII do comprador).
  async infoPublica(token: string) {
    const link = await this.prisma.holderInviteLink.findUnique({
      where: { token },
      select: { order: { select: ORDER_COM_SLOTS.select } },
    });
    if (!link) throw new NotFoundException('Link inválido.');

    const { totalSlots, filledSlots } = contarSlots(link.order);
    const restantes = totalSlots - filledSlots;

    return {
      event_title: link.order.event?.title ?? 'Evento',
      date_start: link.order.event?.dateStart?.toISOString() ?? null,
      venue_name: link.order.event?.venueName ?? null,
      city: link.order.event?.city ?? null,
      state: link.order.event?.state ?? null,
      banner_url: link.order.event?.bannerUrl ?? null,
      slots_restantes: Math.max(0, restantes),
    };
  }

  // "Puxar os dados dela" (pedido do usuário, 09/08/2026): mesmo padrão de
  // segurança do cpf-lookup/cpf-confirmar do cadastro (ver
  // cadastro.service.ts) — nunca revela dado cru só pelo CPF, só uma dica
  // mascarada até a pessoa confirmar telefone/email completo. A diferença
  // aqui é a FONTE: contra o próprio banco do Tipo7 (conta já existente),
  // não a Autosave — o front tenta essa primeiro, cai pra Autosave se não
  // achar (ver /portador/[token]/page.tsx).
  async cpfLookupLocal(cpfRaw: string | undefined) {
    const cpf = apenasDigitos(cpfRaw ?? '');
    if (!validarCPF(cpf)) return { found: false };

    const profile = await this.prisma.profile.findUnique({ where: { cpf }, select: { phone: true, email: true } });
    if (!profile || (!profile.phone && !profile.email)) return { found: false };

    return {
      found: true,
      telefoneMascarado: profile.phone ? maskPhone(profile.phone) : null,
      emailMascarado: profile.email ? maskEmail(profile.email) : null,
    };
  }

  async cpfConfirmarLocal(cpfRaw: string | undefined, valor: string | undefined) {
    const cpf = apenasDigitos(cpfRaw ?? '');
    if (!validarCPF(cpf) || !valor?.trim()) return { ok: false };

    const profile = await this.prisma.profile.findUnique({ where: { cpf } });
    if (!profile) return { ok: false };

    const valorDigitado = valor.trim();
    const bateTelefone = !!profile.phone && apenasDigitos(valorDigitado) === apenasDigitos(profile.phone);
    const bateEmail = !!profile.email && valorDigitado.toLowerCase() === profile.email.toLowerCase();
    if (!bateTelefone && !bateEmail) return { ok: false };

    return {
      ok: true,
      dados: {
        fullName: profile.fullName,
        email: profile.email,
        phone: profile.phone,
        birthDate: profile.birthDate ? profile.birthDate.toISOString().slice(0, 10) : null,
      },
    };
  }

  // Reivindica um dos slots restantes — quem preenche não precisa de conta
  // Tipo7 pra reivindicar, mas ganha uma (senha aleatória, nunca exposta;
  // acesso futuro via "Esqueci minha senha").
  async reivindicar(token: string, body: { full_name?: string; cpf?: string; email?: string; phone?: string; birth_date?: string }) {
    const fullName = body.full_name?.trim();
    const email = body.email?.trim().toLowerCase();
    const cpf = apenasDigitos(body.cpf ?? '');
    const phone = apenasDigitos(body.phone ?? '');
    const birthDateRaw = body.birth_date;

    if (!fullName || !email || !birthDateRaw) throw new BadRequestException('Preencha todos os campos.');
    if (!email.includes('@') || email.length > 254) throw new BadRequestException('Email inválido.');
    if (!validarCPF(cpf)) throw new BadRequestException('CPF inválido.');
    if (phone.length < 10 || phone.length > 11) throw new BadRequestException('WhatsApp inválido — inclua DDD.');

    const link = await this.prisma.holderInviteLink.findUnique({
      where: { token },
      select: { order: { select: ORDER_COM_SLOTS.select } },
    });
    if (!link) throw new NotFoundException('Link inválido.');

    // Checa ANTES de criar o portador se esse CPF já é de uma conta Tipo7 —
    // se for, o ingresso já nasce vinculado a ela (aparece na Meus Ingressos
    // dela, e ninguém mais edita esse portador dali pra frente) e a gente
    // nem tenta criar conta nova.
    const contaExistente = await this.prisma.profile.findUnique({ where: { cpf }, select: { id: true } });

    const birthDate = new Date(birthDateRaw);
    let slot = proximoSlotLivre(link.order);
    if (!slot) throw new ConflictException('Todos os ingressos dessa compra já foram reivindicados.');

    // Corrida entre duas pessoas abrindo o mesmo link ao mesmo tempo — a
    // trava única (order_item_id, slot_number) garante que só uma vence;
    // a outra tenta o próximo slot livre (recarregando o estado real).
    let criado = false;
    for (let tentativa = 0; tentativa < 5 && slot; tentativa++) {
      try {
        await this.prisma.ticketHolder.create({
          data: { orderItemId: slot.orderItemId, slotNumber: slot.slotNumber, fullName, cpf, email, phone, birthDate, userId: contaExistente?.id },
        });
        criado = true;
        break;
      } catch (err) {
        if (!isUniqueConstraintError(err)) throw err;
        const atualizado = await this.prisma.order.findUnique({ where: { id: link.order.id }, ...ORDER_COM_SLOTS });
        slot = atualizado ? proximoSlotLivre(atualizado) : null;
      }
    }
    if (!criado || !slot) throw new ConflictException('Todos os ingressos dessa compra já foram reivindicados.');

    // A partir daqui é tudo best-effort — o ingresso já está salvo, nada
    // abaixo pode fazer a reivindicação "falhar" pro usuário.
    this.autosave.enviarClienteParaAutosave({ full_name: fullName, cpf, email, phone, birth_date: birthDateRaw }).catch(() => {});

    const ticket = await this.prisma.ticket.findFirst({
      where: { orderItemId: slot.orderItemId, slotNumber: slot.slotNumber },
      select: { qrToken: true },
    });
    const eventInfo = link.order.event;
    if (ticket && eventInfo) {
      this.whatsapp.enviar({
        to: phone,
        recipientName: fullName,
        type: 'ingresso_emitido',
        qrData: ticket.qrToken,
        details: {
          nome_evento: eventInfo.title ?? 'Evento',
          data: eventInfo.dateStart?.toISOString() ?? '',
          ingresso: slot.ticketName,
          local: eventInfo.venueName ?? '',
          cidade: eventInfo.city ?? '',
          estado: eventInfo.state ?? '',
        },
      }).catch(() => {});

      this.email.sendTicketEmail({
        to: email,
        buyerName: fullName,
        event: {
          title: eventInfo.title ?? 'Evento',
          date_start: eventInfo.dateStart?.toISOString() ?? null,
          venue_name: eventInfo.venueName, city: eventInfo.city, state: eventInfo.state,
          banner_url: eventInfo.bannerUrl,
        },
        tickets: [{ ticket_name: slot.ticketName, slot_number: slot.slotNumber, qr_token: ticket.qrToken }],
      }).catch((err) => this.logger.error('falha ao mandar email de ingresso reivindicado', err as Error));
    }

    // Cria conta Tipo7 de verdade SE email/cpf/telefone não colidirem com
    // uma conta já existente — nunca sobrescreve/assume uma conta que já
    // é de outra pessoa. Senha aleatória (ninguém sabe, nem nós); quem
    // reivindicou usa "Esqueci minha senha" quando quiser entrar de fato.
    // Se já existe conta (contaExistente, checado acima), nem tenta —
    // o ticket_holder já nasceu com o userId dela.
    if (!contaExistente) {
      try {
        const sessao = await this.authCore.register({
          email, cpf, phone, fullName,
          password: randomBytes(24).toString('base64url'),
          birthDate: birthDateRaw,
        });
        await this.authCore.forgotPassword(email);
        // Vincula o portador recém-criado à conta que acabou de nascer —
        // sem isso o ingresso não apareceria na Meus Ingressos dela.
        await this.prisma.ticketHolder.update({
          where: { orderItemId_slotNumber: { orderItemId: slot.orderItemId, slotNumber: slot.slotNumber } },
          data: { userId: sessao.user.id },
        }).catch(() => {});
      } catch (err) {
        // ConflictException é o caso normal (email/cpf/telefone já cadastrados
        // — a pessoa já tem conta, não mexe nela). Qualquer outro erro aqui é
        // best-effort mas ainda merece log — o ingresso já está salvo de
        // qualquer forma, isso nunca deve derrubar a resposta pro usuário.
        if (!(err instanceof ConflictException)) {
          this.logger.warn(`[holder-links] falha ao criar pré-cadastro pra ${email}: ${err instanceof Error ? err.message : err}`);
        }
      }
    }

    return { ok: true, ticket_name: slot.ticketName, event_title: eventInfo?.title ?? 'Evento' };
  }
}
