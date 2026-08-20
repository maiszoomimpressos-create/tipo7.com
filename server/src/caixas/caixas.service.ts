import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { randomInt } from 'crypto';
import { Prisma } from '../../generated/prisma/client';
import { AuthCoreService } from '../auth-core/auth-core.service';
import { EventFamilyService } from '../common/event-family.service';
import { SaldoBilheteriaService } from '../common/saldo-bilheteria.service';
import { EventPermissionsService } from '../event-permissions/event-permissions.service';
import { OrgAdminService } from '../org-admin/org-admin.service';
import { PrismaService } from '../prisma/prisma.service';

// Mesmo padrão de profile.service.ts / webhooks.service.ts.
function isUniqueConstraintError(err: unknown): err is Prisma.PrismaClientKnownRequestError {
  return err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
}

interface CaixaLote {
  nome: string;
  fundo_inicial: number;
  ingressos_alocados: number;
  // Chave seletora (pedido do usuário, 11/08/2026) — ingresso físico aqui é
  // pulseira de controle de acesso, não o ingresso digital. Default false:
  // sem o promotor ligar isso e informar a quantidade, o caixa não conta
  // nem exibe saldo de ingresso físico nenhum.
  controla_ingressos_fisicos?: boolean;
  operadorId?: string;
  funcaoId?: string | null;
  nomeOperador?: string;
  // Só informativo (pedido do usuário, 10/08/2026) — não abre o caixa
  // sozinho, é só pra registrar "esse caixa vai abrir tal dia/hora" pra
  // planejamento da equipe. ISO datetime.
  horario_previsto?: string;
}

@Injectable()
export class CaixasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly orgAdmin: OrgAdminService,
    private readonly eventFamily: EventFamilyService,
    private readonly saldoBilheteria: SaldoBilheteriaService,
    private readonly authCore: AuthCoreService,
    private readonly eventPermissions: EventPermissionsService,
  ) {}

  // Extraído de getCaixa (Fase 7.2, G7) pra reuso em getCaixaParaOperador —
  // mesma conta, sem mudar o comportamento de getCaixa em si.
  //
  // controlaFisico (pedido do usuário, 11/08/2026): "ingresso físico" aqui
  // é pulseira de controle de acesso, não o ingresso digital em si — nem
  // todo evento usa. Sem essa chave ligada (e sem quantidade informada na
  // criação do caixa), saldoIngressos vem null e o front esconde o painel
  // inteiro, em vez de mostrar um saldo negativo sem sentido pra quem não
  // trabalha com pulseira física nenhuma.
  private async calcularSaldoCaixa(caixaId: string, ingressosAlocados: number, controlaFisico: boolean) {
    const trans = await this.prisma.caixaTransferencia.findMany({
      where: { OR: [{ caixaOrigemId: caixaId }, { caixaDestinoId: caixaId }] },
      select: { caixaOrigemId: true, caixaDestinoId: true, quantidade: true },
    });
    const recebidos = trans.filter((t) => t.caixaDestinoId === caixaId).reduce((s, t) => s + t.quantidade, 0);
    const enviados = trans.filter((t) => t.caixaOrigemId === caixaId).reduce((s, t) => s + t.quantidade, 0);

    // 'approved' apenas — 'pending' inclui PIX aguardando pagamento (QR já
    // gerado mas cliente ainda não pagou, ou venda abandonada sem cancelar).
    // Achado real (10/08/2026): contar 'pending' aqui criava furo de caixa —
    // gerar o QR já entrava em "Total arrecadado" e descontava ingresso
    // físico antes de qualquer pagamento de fato acontecer.
    const orders = await this.prisma.order.findMany({
      where: { caixaId, status: 'approved' },
      select: { id: true, total: true, paymentMethod: true },
    });
    const orderIds = orders.map((o) => o.id);
    let vendidos = 0;
    if (orderIds.length > 0) {
      const itens = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
      vendidos = itens.reduce((s, i) => s + i.quantity, 0);
    }

    let totalDinheiro = 0;
    let totalPix = 0;
    let totalCartao = 0;
    for (const o of orders) {
      const v = Number(o.total ?? 0);
      if (o.paymentMethod === 'dinheiro') totalDinheiro += v;
      else if (o.paymentMethod === 'pix') totalPix += v;
      else if (o.paymentMethod === 'cartao') totalCartao += v;
    }

    // Dinheiro do estacionamento (achado real, 20/08/2026, ao desenhar
    // sangria): esse método só somava dinheiro de ingresso — fechar() soma
    // os dois em código próprio, duplicado. Centralizando aqui também: sem
    // isso, sangria de um caixa misto (bilheteria + estacionamento) validava
    // "quanto tem pra sangrar" olhando só metade do dinheiro de verdade.
    const sessoesEst = await this.prisma.estacionamentoSessao.findMany({
      where: { caixaId, status: 'pago' },
      select: { valorCobrado: true, formaPagamento: true },
    });
    for (const s of sessoesEst) {
      if (s.formaPagamento === 'dinheiro') totalDinheiro += Number(s.valorCobrado ?? 0);
    }

    // Sangria (20/08/2026) — dinheiro retirado da gaveta sem fechar o caixa.
    // Precisa entrar no cálculo do que "deveria ter na gaveta agora", senão
    // toda sangria vira uma diferença falsa na hora de fechar/contar.
    const sangrias = await this.prisma.caixaSangria.findMany({ where: { caixaId }, select: { valor: true } });
    const totalSangrias = sangrias.reduce((s, x) => s + Number(x.valor), 0);

    return {
      controlaIngressosFisicos: controlaFisico,
      saldoIngressos: controlaFisico ? ingressosAlocados + recebidos - enviados - vendidos : null,
      vendidos, recebidos, enviados,
      totalDinheiro, totalPix, totalCartao,
      totalVendas: totalDinheiro + totalPix + totalCartao,
      totalSangrias,
    };
  }

  // GET /eventos/:id/caixas
  async listPorEvento(userId: string, eventoId: string) {
    const evento = await this.prisma.event.findUnique({
      where: { id: eventoId },
      select: { organizationId: true, vendasOnlinePausadas: true, transferenciaRequerSenha: true, pausaVendaAutomatica: true },
    });
    if (!evento) throw new NotFoundException('Evento não encontrado');
    if (!(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) throw new ForbiddenException('Sem permissão');

    const caixas = await this.prisma.caixa.findMany({ where: { eventoId }, orderBy: { createdAt: 'asc' } });

    const operadorIds = [...new Set(caixas.map((c) => c.operadorId).filter((v): v is string => !!v))];
    const nomeMap: Record<string, string> = {};
    const codeMap: Record<string, string> = {};
    const emailMap: Record<string, string> = {};
    if (operadorIds.length > 0) {
      const perfis = await this.prisma.profile.findMany({
        where: { id: { in: operadorIds } },
        select: { id: true, fullName: true, userCode: true },
      });
      for (const p of perfis) {
        nomeMap[p.id] = p.fullName ?? '';
        codeMap[p.id] = p.userCode ?? '';
      }
      const emailRows = await this.prisma.$queryRaw<{ id: string; email: string }[]>`
        SELECT * FROM get_user_emails(${operadorIds}::uuid[])
      `;
      for (const u of emailRows) emailMap[u.id] = u.email ?? '';
    }

    const estacionamentoIds = [...new Set(caixas.map((c) => c.estacionamentoId).filter((v): v is string => !!v))];
    const estacionamentoNomeMap: Record<string, string> = {};
    if (estacionamentoIds.length > 0) {
      const locais = await this.prisma.estacionamento.findMany({
        where: { id: { in: estacionamentoIds } },
        select: { id: true, nome: true },
      });
      for (const l of locais) estacionamentoNomeMap[l.id] = l.nome;
    }

    const result = await Promise.all(
      caixas.map(async (c) => {
        const trans = await this.prisma.caixaTransferencia.findMany({
          where: { OR: [{ caixaOrigemId: c.id }, { caixaDestinoId: c.id }] },
          select: { caixaOrigemId: true, caixaDestinoId: true, quantidade: true },
        });
        const recebidos = trans.filter((t) => t.caixaDestinoId === c.id).reduce((s, t) => s + t.quantidade, 0);
        const enviados = trans.filter((t) => t.caixaOrigemId === c.id).reduce((s, t) => s + t.quantidade, 0);

        // 'approved' apenas — ver nota em calcularSaldoCaixa acima.
        const orders = await this.prisma.order.findMany({
          where: { caixaId: c.id, status: 'approved' },
          select: { id: true, total: true, paymentMethod: true },
        });

        const orderIds = orders.map((o) => o.id);
        let vendidos = 0;
        if (orderIds.length > 0) {
          const itens = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
          vendidos = itens.reduce((s, i) => s + i.quantity, 0);
        }

        let totalDinheiro = 0;
        let totalPix = 0;
        let totalCartao = 0;
        for (const o of orders) {
          const v = Number(o.total ?? 0);
          if (o.paymentMethod === 'dinheiro') totalDinheiro += v;
          else if (o.paymentMethod === 'pix') totalPix += v;
          else if (o.paymentMethod === 'cartao') totalCartao += v;
        }

        return {
          ...c,
          operadorId: c.operadorId ?? null,
          operadorName: (c.operadorId ? nomeMap[c.operadorId] : null) ?? c.nomeOperador ?? null,
          operadorEmail: c.operadorId ? (emailMap[c.operadorId] ?? null) : null,
          operadorCode: c.operadorId ? (codeMap[c.operadorId] ?? null) : null,
          estacionamentoNome: c.estacionamentoId ? (estacionamentoNomeMap[c.estacionamentoId] ?? null) : null,
          saldoIngressos: c.controlaIngressosFisicos ? c.ingressosAlocados + recebidos - enviados - vendidos : null,
          vendidos, recebidos, enviados,
          totalDinheiro, totalPix, totalCartao,
          totalVendas: totalDinheiro + totalPix + totalCartao,
        };
      }),
    );

    const saldoBilheteriaRaw = await this.prisma.saldoBilheteria.findUnique({
      where: { eventId: eventoId },
      select: { ativo: true, saldoAtual: true, metaReserva: true, avisoDisparado: true, bloqueioAtivo: true },
    });
    // Achado real (08/08/2026, varredura): devolvia a linha crua do Prisma
    // (camelCase). GerenciadorCaixas.tsx espera snake_case — o banner de
    // "saldo de bilheteria baixo" nunca aparecia porque aviso_disparado
    // sempre chegava undefined.
    const saldoBilheteria = saldoBilheteriaRaw && {
      ativo: saldoBilheteriaRaw.ativo,
      saldo_atual: saldoBilheteriaRaw.saldoAtual,
      meta_reserva: saldoBilheteriaRaw.metaReserva,
      aviso_disparado: saldoBilheteriaRaw.avisoDisparado,
      bloqueio_ativo: saldoBilheteriaRaw.bloqueioAtivo,
    };

    return {
      caixas: result,
      vendas_online_pausadas: evento.vendasOnlinePausadas,
      transferencia_requer_senha: evento.transferenciaRequerSenha,
      pausa_venda_automatica: evento.pausaVendaAutomatica,
      saldoBilheteria,
    };
  }

  // GET /caixas/:caixaId
  async getCaixa(userId: string, caixaId: string) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      include: { evento: { select: { title: true, dateStart: true, venueName: true, city: true, state: true, transferenciaRequerSenha: true, organizationId: true } } },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');

    const isOwner = await this.orgAdmin.isOrgAdmin(caixa.evento.organizationId, userId);
    const isOperador = caixa.operadorId === userId;
    if (!isOwner && !isOperador) throw new ForbiddenException('Sem permissão');

    const saldo = await this.calcularSaldoCaixa(caixaId, caixa.ingressosAlocados, caixa.controlaIngressosFisicos);

    // Achado real (08/08/2026, varredura): espalhava a linha crua do Prisma
    // (camelCase). CaixaSidebar.tsx lê stats.fundo_inicial (snake_case) e
    // mostrava "R$ NaN" — o resto (evento, saldo) já é objeto próprio, não
    // precisa remapear.
    const { evento, fundoInicial, ...caixaFields } = caixa;
    return {
      ...caixaFields,
      fundo_inicial: fundoInicial,
      evento,
      ...saldo,
      expectedGaveta: Number(fundoInicial) + saldo.totalDinheiro - saldo.totalSangrias,
    };
  }

  // GET /eventos/:id/meu-caixa — caixa aberto designado ao usuário logado
  // neste evento (Fase 7.2, G7). Usado por trabalho/bilheteria/estacionamento
  // pra saber se o operador já tem um caixa pra vender/cobrar.
  async getMeuCaixaAberto(userId: string, eventoId: string) {
    const caixa = await this.prisma.caixa.findFirst({
      where: { eventoId, operadorId: userId, status: 'aberto' },
      select: { id: true, nome: true },
    });
    return caixa ?? null;
  }

  // Pedido do usuário (09/08/2026) — entrada da Segunda Tela sem precisar
  // digitar/saber a URL do evento: loga com a mesma conta que está com o
  // caixa aberto, o sistema já acha sozinho. Sem filtro de evento (varre
  // todos), porque o objetivo é achar em qual caixa a pessoa está
  // trabalhando AGORA, não sabe de antemão em qual evento.
  async getMeusCaixasAbertos(userId: string) {
    const caixas = await this.prisma.caixa.findMany({
      where: { operadorId: userId, status: 'aberto' },
      select: {
        id: true, nome: true, eventoId: true,
        evento: { select: { title: true } },
      },
      orderBy: { abertoEm: 'desc' },
    });
    return caixas.map((c) => ({ id: c.id, nome: c.nome, evento_id: c.eventoId, evento_title: c.evento.title ?? 'Evento' }));
  }

  // GET /caixas/:caixaId/bootstrap — dados completos pra abrir a tela de
  // venda de um caixa (Fase 7.2, G7). Diferente de getCaixa (só-dono-ou-
  // operador, usado por outros fluxos como fechar/transferir), esta rota
  // TAMBÉM libera staff ativo com a permissão vender_ingresso mesmo sem
  // ser o operador designado daquele caixa específico — mesmo comportamento
  // de bilheteria/[eventoId]/caixa/[caixaId]/page.tsx original ("Também
  // permite staff com permissão vender_ingresso, sem caixa designado").
  async getCaixaParaOperador(userId: string, caixaId: string) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      include: {
        evento: {
          select: { id: true, title: true, dateStart: true, venueName: true, city: true, state: true, organizationId: true },
        },
      },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado.');
    if (caixa.status === 'fechado') throw new BadRequestException('Este caixa já foi fechado.');
    if (caixa.status === 'fechamento_pendente') {
      throw new BadRequestException('A contagem deste caixa já foi enviada — aguardando validação do organizador.');
    }

    const isOwner = await this.orgAdmin.isOrgAdmin(caixa.evento.organizationId, userId);
    const isOperador = caixa.operadorId === userId;
    const isVendedor =
      !isOwner && !isOperador
        ? await this.eventPermissions.hasEventPermission(userId, caixa.eventoId, 'vender_ingresso')
        : false;
    if (!isOwner && !isOperador && !isVendedor) {
      throw new ForbiddenException('Você não tem permissão para acessar este caixa.');
    }

    const saldo = await this.calcularSaldoCaixa(caixaId, caixa.ingressosAlocados, caixa.controlaIngressosFisicos);

    // Tickets de toda a família vendável (o próprio evento + filhos que
    // optaram por vender no caixa do pai) — mesma lógica de
    // web/src/lib/eventFamily.ts, já portada em EventFamilyService.
    const eventosVendaveis = await this.eventFamily.getEventosVendaveisNoCaixa(caixa.eventoId);
    const eventoIdsVendaveis = eventosVendaveis.map((e) => e.id);
    const eventoTituloMap = Object.fromEntries(eventosVendaveis.map((e) => [e.id, e.title]));

    const ticketsRaw = await this.prisma.eventTicket.findMany({
      where: { eventId: { in: eventoIdsVendaveis } },
      select: { id: true, name: true, price: true, quantity: true, eventId: true },
    });

    // Agrupa por evento (pai primeiro, filhos depois) antes de ordenar por
    // preço dentro do grupo — mesma ordem que a página original montava.
    const ordemEvento = new Map(eventoIdsVendaveis.map((id, i) => [id, i]));
    const tickets = [...ticketsRaw].sort((a, b) => {
      const posA = ordemEvento.get(a.eventId) ?? 0;
      const posB = ordemEvento.get(b.eventId) ?? 0;
      return posA !== posB ? posA - posB : Number(a.price) - Number(b.price);
    });

    const ticketIds = tickets.map((t) => t.id);
    const vendidosPorTicket: Record<string, number> = {};
    if (ticketIds.length > 0) {
      const ordensAtivas = await this.prisma.order.findMany({
        where: { eventId: { in: eventoIdsVendaveis }, status: { notIn: ['rejected', 'cancelled'] } },
        select: { id: true },
      });
      const orderIds = ordensAtivas.map((o) => o.id);
      if (orderIds.length > 0) {
        const itens = await this.prisma.orderItem.findMany({
          where: { orderId: { in: orderIds }, ticketId: { in: ticketIds } },
          select: { ticketId: true, quantity: true },
        });
        for (const item of itens) {
          if (!item.ticketId) continue;
          vendidosPorTicket[item.ticketId] = (vendidosPorTicket[item.ticketId] ?? 0) + item.quantity;
        }
      }
    }

    const profile = await this.prisma.profile.findUnique({ where: { id: userId }, select: { fullName: true } });

    const { evento, ...caixaFields } = caixa;
    return {
      ...caixaFields,
      evento,
      isOwner,
      ...saldo,
      ingressos: tickets.map((t) => {
        const vendidos = vendidosPorTicket[t.id] ?? 0;
        return {
          id: t.id,
          name: t.name ?? 'Ingresso',
          price: Number(t.price ?? 0),
          disponivel: Math.max(0, (t.quantity ?? 0) - vendidos),
          eventoId: t.eventId,
          eventoTitle: eventoTituloMap[t.eventId] ?? evento.title ?? 'Evento',
        };
      }),
      operadorName: profile?.fullName ?? 'Operador',
    };
  }

  // PATCH /caixas/:caixaId — pedido do usuário (10/08/2026): editar nome e
  // fundo inicial (troco) de um caixa já aberto, sem precisar fechar e abrir
  // de novo. Só funciona com o caixa aberto (fechado é histórico financeiro,
  // não mexe pra não bagunçar reconciliação de um caixa já encerrado).
  async atualizar(userId: string, caixaId: string, body: { nome?: string; fundo_inicial?: number }) {
    const caixa = await this.prisma.caixa.findUnique({
      where: { id: caixaId },
      select: { id: true, eventoId: true, status: true, nome: true },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');

    const evento = await this.prisma.event.findUnique({ where: { id: caixa.eventoId }, select: { organizationId: true } });
    if (!evento || !(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) throw new ForbiddenException('Sem permissão');
    if (caixa.status !== 'aberto') throw new BadRequestException('Só é possível editar um caixa aberto.');

    const data: { nome?: string; fundoInicial?: number } = {};

    if (body.nome !== undefined) {
      const nome = body.nome.trim();
      if (!nome) throw new BadRequestException('Nome não pode ficar vazio.');
      if (nome !== caixa.nome) {
        const existe = await this.prisma.caixa.findFirst({
          where: { eventoId: caixa.eventoId, status: 'aberto', nome, id: { not: caixaId } },
          select: { id: true },
        });
        if (existe) throw new BadRequestException(`Já existe um caixa aberto chamado "${nome}".`);
      }
      data.nome = nome;
    }

    if (body.fundo_inicial !== undefined) {
      if (body.fundo_inicial < 0) throw new BadRequestException('Fundo inicial não pode ser negativo.');
      data.fundoInicial = body.fundo_inicial;
    }

    if (Object.keys(data).length === 0) throw new BadRequestException('Nada pra atualizar.');

    await this.prisma.caixa.update({ where: { id: caixaId }, data });
    return { ok: true };
  }

  // Garante que o DONO do evento também tem token pra autorizar sangria, sem
  // precisar virar staff "de verdade" nem passar pelo fluxo de convite
  // (achado real, 20/08/2026: sem isso, só a senha da conta funcionava como
  // autorização — o dono pediu menos fricção agora, delegação de verdade
  // por função/supervisor fica pra depois). Mesma tabela EventStaff, só que
  // sem eventPositionId — resolverAutorizacaoSangria() abaixo trata "é o
  // dono" como permissão implícita, mesmo padrão de isOwner em todo o resto
  // do sistema. Chamado toda vez que o dono abre um caixa; é barato — só
  // cria de verdade na primeira vez, as próximas só confirmam que já existe.
  //
  // Token é gerado por nós (não precisa ser memorizável, só bater com o que
  // tá gravado). PIN é diferente — precisa ser algo que a pessoa escolha e
  // lembre, vai digitar isso o evento inteiro (correção de rumo, 20/08/2026:
  // a 1ª versão gerava PIN aleatório também, ficou inconsistente com o resto
  // do sistema onde é sempre o próprio operador quem escolhe). Por isso não
  // cria PIN aqui — só devolve o staffId pro front reaproveitar o MESMO
  // formulário de criar PIN que já existe pra equipe convidada
  // (POST /trabalhos/pin já aceita esse staffId, já que status vem 'active').
  // Público — também chamado por EstacionamentoService.abrirCaixa() (mesmo
  // caso de uso, evento com estacionamento em vez de bilheteria).
  async garantirAcessoOwnerParaSangria(eventoId: string, ownerId: string): Promise<{ staffId: string; token: string; precisaCriarPin: boolean }> {
    const existente = await this.prisma.eventStaff.findUnique({
      where: { eventId_userId: { eventId: eventoId, userId: ownerId } },
      select: { id: true, token: true, pinHash: true },
    });
    if (existente?.token) {
      return { staffId: existente.id, token: existente.token, precisaCriarPin: !existente.pinHash };
    }

    for (let tentativa = 0; tentativa < 5; tentativa++) {
      try {
        const token = String(randomInt(0, 100_000_000)).padStart(8, '0');
        const staff = await this.prisma.eventStaff.upsert({
          where: { eventId_userId: { eventId: eventoId, userId: ownerId } },
          create: { eventId: eventoId, userId: ownerId, status: 'active', token },
          update: { token },
          select: { id: true, token: true },
        });
        return { staffId: staff.id, token: staff.token!, precisaCriarPin: true };
      } catch (err) {
        if (isUniqueConstraintError(err) && tentativa < 4) continue;
        throw err;
      }
    }
    throw new BadRequestException('Não foi possível gerar o acesso do organizador.');
  }

  // POST /caixas/abrir
  async abrir(
    userId: string,
    body: { eventoId: string; caixas: CaixaLote[]; transferencia_requer_senha: boolean; ativarSaldoBilheteria?: boolean },
  ) {
    if (!body.eventoId || !Array.isArray(body.caixas) || body.caixas.length === 0) {
      throw new BadRequestException('Dados inválidos');
    }

    const evento = await this.prisma.event.findUnique({ where: { id: body.eventoId }, select: { organizationId: true } });
    if (!evento) throw new NotFoundException('Evento não encontrado');
    if (!(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) throw new ForbiddenException('Sem permissão');

    const nomesLote = body.caixas.map((c) => c.nome.trim());
    if (new Set(nomesLote).size !== nomesLote.length) throw new BadRequestException('Cada caixa deve ter um nome único.');

    const caixasExistentes = await this.prisma.caixa.findMany({
      where: { eventoId: body.eventoId, status: 'aberto' },
      select: { nome: true },
    });
    const nomesAbertos = new Set(caixasExistentes.map((c) => c.nome));
    for (const nome of nomesLote) {
      if (nomesAbertos.has(nome)) throw new BadRequestException(`Já existe um caixa aberto chamado "${nome}". Escolha um nome diferente.`);
    }

    const operadoresLote = body.caixas.filter((c) => c.operadorId).map((c) => c.operadorId!);
    if (new Set(operadoresLote).size !== operadoresLote.length) {
      throw new BadRequestException('Um operador não pode operar dois caixas ao mesmo tempo.');
    }

    if (operadoresLote.length > 0) {
      const caixasComOp = await this.prisma.caixa.findMany({
        where: { eventoId: body.eventoId, status: 'aberto', operadorId: { in: operadoresLote } },
        select: { nome: true },
      });
      if (caixasComOp.length > 0) {
        throw new BadRequestException(`Um dos operadores já está operando o caixa "${caixasComOp[0].nome}".`);
      }
    }

    const criados = await this.prisma.$transaction(
      body.caixas.map((c) =>
        this.prisma.caixa.create({
          data: {
            eventoId: body.eventoId,
            operadorId: c.operadorId ?? null,
            nomeOperador: c.nomeOperador ?? null,
            nome: c.nome,
            fundoInicial: c.fundo_inicial,
            ingressosAlocados: c.ingressos_alocados,
            controlaIngressosFisicos: c.controla_ingressos_fisicos ?? false,
            createdBy: userId,
            horarioPrevisto: c.horario_previsto ? new Date(c.horario_previsto) : null,
          },
        }),
      ),
    );

    for (const c of body.caixas) {
      if (c.operadorId && c.funcaoId) {
        await this.prisma.eventStaff.upsert({
          where: { eventId_userId: { eventId: body.eventoId, userId: c.operadorId } },
          create: { eventId: body.eventoId, userId: c.operadorId, eventPositionId: c.funcaoId, status: 'pending', invitedBy: userId },
          update: { eventPositionId: c.funcaoId, status: 'pending', invitedBy: userId },
        });
      }
    }

    await this.prisma.event.update({
      where: { id: body.eventoId },
      data: { vendasOnlinePausadas: false, transferenciaRequerSenha: body.transferencia_requer_senha },
    });

    if (body.ativarSaldoBilheteria) {
      await this.saldoBilheteria.ativarSaldoBilheteria(body.eventoId, userId);
    }

    const acessoOwner = await this.garantirAcessoOwnerParaSangria(body.eventoId, userId);

    return {
      caixas: criados,
      owner_acesso: { staff_id: acessoOwner.staffId, token: acessoOwner.token, precisa_criar_pin: acessoOwner.precisaCriarPin },
    };
  }

  // POST /caixas/pausar
  async pausar(userId: string, body: { eventoId: string; pausar: boolean }) {
    if (!body.eventoId) throw new BadRequestException('eventoId obrigatório');

    const evento = await this.prisma.event.findUnique({ where: { id: body.eventoId }, select: { organizationId: true } });
    if (!evento) throw new NotFoundException('Evento não encontrado');
    if (!(await this.orgAdmin.isOrgAdmin(evento.organizationId, userId))) throw new ForbiddenException('Sem permissão');

    await this.prisma.event.update({ where: { id: body.eventoId }, data: { vendasOnlinePausadas: body.pausar } });
    return { ok: true, pausado: body.pausar };
  }

  // POST /caixas/transferir
  async transferir(
    userId: string,
    body: { caixaOrigemId: string; caixaDestinoId: string; quantidade: number; senhaPromotor?: string },
  ) {
    if (!body.caixaOrigemId || !body.caixaDestinoId || !body.quantidade || body.quantidade <= 0) {
      throw new BadRequestException('Dados inválidos');
    }

    const origem = await this.prisma.caixa.findUnique({
      where: { id: body.caixaOrigemId },
      include: { evento: { select: { organizationId: true, transferenciaRequerSenha: true } } },
    });
    const destino = await this.prisma.caixa.findUnique({
      where: { id: body.caixaDestinoId },
      select: { id: true, eventoId: true, status: true, operadorId: true, controlaIngressosFisicos: true },
    });
    if (!origem || !destino) throw new NotFoundException('Caixa não encontrado');

    const [familiaOrigem, familiaDestino] = await Promise.all([
      this.eventFamily.getFamiliaRoot(origem.eventoId),
      this.eventFamily.getFamiliaRoot(destino.eventoId),
    ]);
    if (familiaOrigem !== familiaDestino) throw new BadRequestException('Caixas de eventos diferentes');
    if (origem.status !== 'aberto' || destino.status !== 'aberto') throw new BadRequestException('Ambos os caixas devem estar abertos');

    const isOwner = await this.orgAdmin.isOrgAdmin(origem.evento.organizationId, userId);
    const isOperador = origem.operadorId === userId || destino.operadorId === userId;
    if (!isOwner && !isOperador) throw new ForbiddenException('Sem permissão');

    if (origem.evento.transferenciaRequerSenha && !isOwner) {
      if (!body.senhaPromotor) {
        throw new ForbiddenException('Esta transferência requer autorização do promotor.');
      }
      // Autorização por senha de login do dono (bcrypt local — qualquer erro
      // bloqueia a transferência, mesmo padrão do original).
      const org = await this.prisma.organization.findUnique({ where: { id: origem.evento.organizationId }, select: { ownerId: true } });
      const senhaOk = org?.ownerId ? await this.authCore.verifyPassword(org.ownerId, body.senhaPromotor) : false;
      if (!senhaOk) throw new ForbiddenException('Senha do promotor incorreta');
    }

    // Transferência é especificamente de ingresso físico (pulseira) — sem
    // controle físico ligado nos dois lados não tem o que transferir de
    // verdade (pedido do usuário, 11/08/2026).
    if (!origem.controlaIngressosFisicos || !destino.controlaIngressosFisicos) {
      throw new BadRequestException('Transferência de ingressos físicos exige que origem e destino tenham o controle de ingressos físicos ligado.');
    }

    // Achado real (08/08/2026, varredura): o saldo era calculado em queries
    // separadas do create() final, sem transação/lock cobrindo o intervalo —
    // duas transferências simultâneas do mesmo caixa de origem perto do
    // limite podiam ambas passar o check e deixar o saldo negativo. Isolamento
    // Serializable força o Postgres a rejeitar uma das duas com erro de
    // conflito de escrita (P2034), tratado abaixo como "tente de novo".
    let resultado: { transferencia: unknown; saldoOrigemApos: number };
    try {
      resultado = await this.prisma.$transaction(
        async (tx) => {
          const transOrigens = await tx.caixaTransferencia.findMany({
            where: { OR: [{ caixaOrigemId: body.caixaOrigemId }, { caixaDestinoId: body.caixaOrigemId }] },
            select: { caixaOrigemId: true, caixaDestinoId: true, quantidade: true },
          });
          const recebidos = transOrigens.filter((t) => t.caixaDestinoId === body.caixaOrigemId).reduce((s, t) => s + t.quantidade, 0);
          const enviados = transOrigens.filter((t) => t.caixaOrigemId === body.caixaOrigemId).reduce((s, t) => s + t.quantidade, 0);

          // 'approved' apenas — ver nota em calcularSaldoCaixa acima.
          const ordersOrigem = await tx.order.findMany({
            where: { caixaId: body.caixaOrigemId, status: 'approved' },
            select: { id: true },
          });
          const orderIds = ordersOrigem.map((o) => o.id);
          let vendidosOrigem = 0;
          if (orderIds.length > 0) {
            const itens = await tx.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
            vendidosOrigem = itens.reduce((s, i) => s + i.quantity, 0);
          }

          const saldoOrigem = origem.ingressosAlocados + recebidos - enviados - vendidosOrigem;
          if (body.quantidade > saldoOrigem) {
            throw new BadRequestException(`Saldo insuficiente. Origem tem ${saldoOrigem} ingresso(s) disponíveis.`);
          }

          const transferencia = await tx.caixaTransferencia.create({
            data: {
              eventoId: origem.eventoId,
              caixaOrigemId: body.caixaOrigemId,
              caixaDestinoId: body.caixaDestinoId,
              quantidade: body.quantidade,
              autorizadoPor: isOwner ? userId : null,
            },
          });

          return { transferencia, saldoOrigemApos: saldoOrigem - body.quantidade };
        },
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2034') {
        throw new ConflictException('Outra transferência foi feita nesse caixa ao mesmo tempo. Tente de novo.');
      }
      throw err;
    }

    return resultado;
  }

  // POST /caixas/fechar
  async fechar(userId: string, body: { caixaId: string; dinheiro_contado: number; ingressos_devolvidos: number; observacoes?: string }) {
    if (!body.caixaId) throw new BadRequestException('caixaId obrigatório');

    const caixa = await this.prisma.caixa.findUnique({
      where: { id: body.caixaId },
      include: { evento: { select: { organizationId: true } } },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');
    if (caixa.status === 'fechado') throw new BadRequestException('Caixa já fechado');
    if (caixa.status === 'fechamento_pendente') throw new BadRequestException('Contagem já enviada, aguardando validação do organizador');

    const isOwner = await this.orgAdmin.isOrgAdmin(caixa.evento.organizationId, userId);
    const isOperador = caixa.operadorId === userId;
    if (!isOwner && !isOperador) throw new ForbiddenException('Sem permissão');

    const transferencias = await this.prisma.caixaTransferencia.findMany({
      where: { OR: [{ caixaOrigemId: body.caixaId }, { caixaDestinoId: body.caixaId }] },
      select: { caixaOrigemId: true, caixaDestinoId: true, quantidade: true },
    });
    const recebidos = transferencias.filter((t) => t.caixaDestinoId === body.caixaId).reduce((s, t) => s + t.quantidade, 0);
    const enviados = transferencias.filter((t) => t.caixaOrigemId === body.caixaId).reduce((s, t) => s + t.quantidade, 0);

    // 'approved' apenas — ver nota em calcularSaldoCaixa acima.
    const orders = await this.prisma.order.findMany({
      where: { caixaId: body.caixaId, status: 'approved' },
      select: { id: true, total: true, paymentMethod: true },
    });
    const orderIds = orders.map((o) => o.id);
    let vendidos = 0;
    let totalDinheiroIngressos = 0;
    if (orderIds.length > 0) {
      const itens = await this.prisma.orderItem.findMany({ where: { orderId: { in: orderIds } }, select: { quantity: true } });
      vendidos = itens.reduce((s, i) => s + i.quantity, 0);
    }
    for (const o of orders) {
      if (o.paymentMethod === 'dinheiro') totalDinheiroIngressos += Number(o.total ?? 0);
    }

    const sessoesEst = await this.prisma.estacionamentoSessao.findMany({
      where: { caixaId: body.caixaId, status: 'pago' },
      select: { valorCobrado: true, formaPagamento: true },
    });
    let totalDinheiroEstacionamento = 0;
    for (const s of sessoesEst) {
      if (s.formaPagamento === 'dinheiro') totalDinheiroEstacionamento += Number(s.valorCobrado ?? 0);
    }

    // Sangria (20/08/2026) — desconta do esperado, senão toda retirada feita
    // durante o turno aparece como "sumiu dinheiro" na hora de fechar.
    const sangrias = await this.prisma.caixaSangria.findMany({ where: { caixaId: body.caixaId }, select: { valor: true } });
    const totalSangrias = sangrias.reduce((s, x) => s + Number(x.valor), 0);

    const totalDinheiro = totalDinheiroIngressos + totalDinheiroEstacionamento;
    const ingressosEntregues = caixa.ingressosAlocados + recebidos - enviados;
    const expectedGaveta = Number(caixa.fundoInicial) + totalDinheiro - totalSangrias;
    const diferencaDinheiro = expectedGaveta - body.dinheiro_contado;
    // null quando o caixa não controla ingresso físico — sem estoque de
    // pulseira de verdade, essa conta não tem o que representar (pedido do
    // usuário, 11/08/2026).
    const diferencaIngressos = caixa.controlaIngressosFisicos
      ? ingressosEntregues - vendidos - body.ingressos_devolvidos
      : null;

    const agora = new Date();

    try {
      await this.prisma.caixaFechamento.create({
        data: {
          caixaId: body.caixaId,
          dinheiroContado: body.dinheiro_contado,
          ingressosDevolvidos: body.ingressos_devolvidos,
          diferencaDinheiro,
          diferencaIngressos,
          observacoes: body.observacoes,
          fechadoPor: userId,
          ...(isOwner ? { validadoPor: userId, validadoEm: agora } : {}),
        },
      });
    } catch (err) {
      // Achado real (08/08/2026, varredura): caixaId é @unique em
      // CaixaFechamento — os guard-clauses de status não cobrem duplo
      // toque/retry simultâneo. Sem isso, o segundo envio estourava 500 cru.
      if (isUniqueConstraintError(err)) throw new ConflictException('Este caixa já foi fechado (provavelmente por outro envio simultâneo).');
      throw err;
    }
    await this.prisma.caixa.update({
      where: { id: body.caixaId },
      data: isOwner ? { status: 'fechado', fechadoEm: agora } : { status: 'fechamento_pendente' },
    });

    return {
      ok: true,
      pendente: !isOwner,
      apuracao: {
        fundo_inicial: Number(caixa.fundoInicial),
        total_dinheiro: totalDinheiro,
        total_dinheiro_ingressos: totalDinheiroIngressos,
        total_dinheiro_estacionamento: totalDinheiroEstacionamento,
        total_sangrias: totalSangrias,
        expected_gaveta: expectedGaveta,
        dinheiro_contado: body.dinheiro_contado,
        diferenca_dinheiro: diferencaDinheiro,
        controla_ingressos_fisicos: caixa.controlaIngressosFisicos,
        ingressos_alocados: caixa.controlaIngressosFisicos ? caixa.ingressosAlocados : null,
        recebidos, enviados, vendidos,
        ingressos_devolvidos: body.ingressos_devolvidos,
        diferenca_ingressos: diferencaIngressos,
      },
    };
  }

  // POST /caixas/validar
  async validar(userId: string, body: { caixaId: string }) {
    if (!body.caixaId) throw new BadRequestException('caixaId obrigatório');

    const caixa = await this.prisma.caixa.findUnique({
      where: { id: body.caixaId },
      include: { evento: { select: { organizationId: true } } },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');
    if (caixa.status !== 'fechamento_pendente') throw new BadRequestException('Este caixa não tem contagem pendente de validação');

    if (!(await this.orgAdmin.isOrgAdmin(caixa.evento.organizationId, userId))) {
      throw new ForbiddenException('Só o dono/admin do evento pode validar o fechamento');
    }

    const fechamento = await this.prisma.caixaFechamento.findFirst({
      where: { caixaId: body.caixaId, validadoPor: null },
      orderBy: { criadoEm: 'desc' },
      select: { id: true },
    });
    if (!fechamento) throw new NotFoundException('Contagem não encontrada para este caixa');

    const agora = new Date();
    await this.prisma.caixaFechamento.update({ where: { id: fechamento.id }, data: { validadoPor: userId, validadoEm: agora } });
    await this.prisma.caixa.update({ where: { id: body.caixaId }, data: { status: 'fechado', fechadoEm: agora } });

    return { ok: true };
  }

  // POST /caixas/sangria (20/08/2026, design combinado — ver
  // project_token_pin_acesso_caixa na memória). Retirada parcial de dinheiro
  // da gaveta sem fechar o caixa. Quem opera a tela (isOwner/isOperador,
  // mesma checagem de sempre) pode não ser quem literalmente pega o
  // dinheiro — por isso não usa a sessão logada pra saber "quem retirou",
  // pede um segundo código (PIN de staff autorizado, ou senha do dono).
  async sangrar(userId: string, body: { caixaId?: string; valor?: number; motivo?: string; codigo?: string }) {
    if (!body.caixaId || !body.valor || body.valor <= 0) throw new BadRequestException('Dados inválidos');
    if (!body.codigo?.trim()) throw new BadRequestException('Informe o código de quem está retirando o dinheiro');

    const caixa = await this.prisma.caixa.findUnique({
      where: { id: body.caixaId },
      include: { evento: { select: { organizationId: true } } },
    });
    if (!caixa) throw new NotFoundException('Caixa não encontrado');
    if (caixa.status !== 'aberto') throw new BadRequestException('Só é possível sangrar um caixa aberto');

    const isOwner = await this.orgAdmin.isOrgAdmin(caixa.evento.organizationId, userId);
    const isOperador = caixa.operadorId === userId;
    if (!isOwner && !isOperador) throw new ForbiddenException('Sem permissão');

    const saldo = await this.calcularSaldoCaixa(caixa.id, caixa.ingressosAlocados, caixa.controlaIngressosFisicos);
    const disponivel = Number(caixa.fundoInicial) + saldo.totalDinheiro - saldo.totalSangrias;
    if (body.valor > disponivel) {
      throw new BadRequestException(`Saldo insuficiente na gaveta. Disponível: R$ ${disponivel.toFixed(2)}.`);
    }

    const retiradoPorUserId = await this.resolverAutorizacaoSangria(caixa.eventoId, caixa.evento.organizationId, body.codigo.trim());

    await this.prisma.caixaSangria.create({
      data: { caixaId: caixa.id, valor: body.valor, motivo: body.motivo?.trim() || null, retiradoPorUserId },
    });

    const perfil = await this.prisma.profile.findUnique({ where: { id: retiradoPorUserId }, select: { fullName: true } });

    return { ok: true, retirado_por: perfil?.fullName ?? 'Desconhecido', saldo_restante: disponivel - body.valor };
  }

  // Acha o dono do código digitado: staff ativo do MESMO evento com PIN
  // batendo E permissão 'autorizar_sangria' na função dele, ou — fallback —
  // a senha da conta do dono/organizador do evento (mesmo bcrypt.compare de
  // authCore.verifyPassword, já usado em transferir()). PIN é único por
  // evento (garantido em trabalhos.service.ts > definirPin()), então o
  // primeiro match já é decisivo — não precisa continuar comparando.
  private async resolverAutorizacaoSangria(eventoId: string, organizationId: string, codigo: string): Promise<string> {
    const staffAtivo = await this.prisma.eventStaff.findMany({
      where: { eventId: eventoId, status: 'active', pinHash: { not: null } },
      select: { userId: true, pinHash: true, eventPosition: { select: { eventPositionPermissions: { select: { permission: true } } } } },
    });
    for (const s of staffAtivo) {
      if (s.pinHash && (await bcrypt.compare(codigo, s.pinHash))) {
        // Dono do evento sempre pode, mesmo sem função/permissão explícita —
        // é a linha "invisível" criada por garantirAcessoOwnerParaSangria()
        // acima, sem eventPositionId. Mesmo padrão de isOwner bypassando
        // checagem granular em hasEventPermission().
        const ehDono = await this.orgAdmin.isOrgAdmin(organizationId, s.userId);
        const temPermissao = ehDono || (s.eventPosition?.eventPositionPermissions ?? []).some((p) => p.permission === 'autorizar_sangria');
        if (!temPermissao) throw new ForbiddenException('Essa pessoa não tem permissão para autorizar sangria.');
        return s.userId;
      }
    }

    const org = await this.prisma.organization.findUnique({ where: { id: organizationId }, select: { ownerId: true } });
    if (org?.ownerId && (await this.authCore.verifyPassword(org.ownerId, codigo))) {
      return org.ownerId;
    }

    throw new ForbiddenException('Código de autorização inválido.');
  }

  // "Assinatura" do dono pra ações sensíveis fora do módulo de caixa (hoje:
  // encerramento forçado de evento com pendência — ver
  // EventosAdminService.encerrar()). Mesmo princípio da sangria: PIN
  // (dele mesmo, dessa vez — não de terceiro) ou senha da conta como
  // fallback. Público — chamado pelo EventosModule via injeção de
  // CaixasService.
  async verificarPinOuSenhaDono(eventoId: string, ownerId: string, codigo: string): Promise<boolean> {
    const staff = await this.prisma.eventStaff.findUnique({
      where: { eventId_userId: { eventId: eventoId, userId: ownerId } },
      select: { pinHash: true },
    });
    if (staff?.pinHash && (await bcrypt.compare(codigo, staff.pinHash))) return true;

    return this.authCore.verifyPassword(ownerId, codigo);
  }
}
