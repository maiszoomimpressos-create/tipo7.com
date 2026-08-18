import { BadRequestException, ConflictException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { AutosaveService } from '../common/autosave.service';
import { calcularValorEstacionamento } from '../common/estacionamento-pricing.util';
import { WhatsAppService } from '../common/whatsapp.service';
import { EventPermissionsService } from '../event-permissions/event-permissions.service';
import { PrismaService } from '../prisma/prisma.service';

// Achado real (08/08/2026, varredura pós-bug do admin/api): listEstacionamentos
// e listSessoes devolviam a linha crua do Prisma (camelCase) pro front, que
// espera snake_case (GerenciadorEstacionamentos.tsx / AtendenteClient.tsx).
// Isso deixava a tela de gestão sem mostrar preço/portões e — mais grave —
// travava a saída de veículo em qualquer estacionamento pago ou com portão
// (o preview de valor e a seleção de portão de saída dependiam de campos que
// sempre chegavam undefined). listEstacionamentosAtivos (rota irmã, usada
// pelo atendente) já remapeia isso manualmente no page.tsx — não mexer nela.
function mapPortao(p: { id: string; nome: string; tipo: string; ativo: boolean }) {
  return { id: p.id, nome: p.nome, tipo: p.tipo, ativo: p.ativo };
}

function mapEstacionamento(e: {
  id: string; nome: string; cobraModo: string; precoFixo: unknown; precoPrimeiraHora: unknown;
  precoHoraAdicional: unknown; tetoDiario: unknown; toleranciaMinutos: number; controlaSaida: boolean;
  vagasTotais: number | null; ativo: boolean; estacionamentoPortoes: Parameters<typeof mapPortao>[0][];
}) {
  return {
    id: e.id, nome: e.nome, cobra_modo: e.cobraModo,
    preco_fixo: e.precoFixo, preco_primeira_hora: e.precoPrimeiraHora, preco_hora_adicional: e.precoHoraAdicional,
    teto_diario: e.tetoDiario, tolerancia_minutos: e.toleranciaMinutos, controla_saida: e.controlaSaida,
    vagas_totais: e.vagasTotais, ativo: e.ativo,
    estacionamento_portoes: e.estacionamentoPortoes.map(mapPortao),
  };
}

@Injectable()
export class EstacionamentoService {
  private readonly logger = new Logger(EstacionamentoService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventPermissions: EventPermissionsService,
    private readonly autosave: AutosaveService,
    private readonly whatsapp: WhatsAppService,
  ) {}

  // ==== CRUD de estacionamentos (dono/admin do evento) ====

  async listEstacionamentos(userId: string, eventoId: string) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const estacionamentos = await this.prisma.estacionamento.findMany({
      where: { eventId: eventoId },
      orderBy: { createdAt: 'asc' },
      include: { estacionamentoPortoes: true },
    });
    return { estacionamentos: estacionamentos.map(mapEstacionamento) };
  }

  // GET /eventos/:id/estacionamentos/ativos — porte de
  // estacionamento/[eventoId]/page.tsx (Fase 7.2, G7). Diferente do CRUD
  // acima (só dono), libera também staff ativo com permissão de entrada
  // OU saída — o atendente do portão não é dono do evento.
  async listEstacionamentosAtivos(userId: string, eventoId: string) {
    if (!(await this.eventPermissions.hasEventPermission(userId, eventoId, ['estacionamento_entrada', 'estacionamento_saida']))) {
      throw new ForbiddenException('Sem permissão');
    }

    const estacionamentos = await this.prisma.estacionamento.findMany({
      where: { eventId: eventoId, ativo: true },
      orderBy: { createdAt: 'asc' },
      include: { estacionamentoPortoes: true },
    });
    return { estacionamentos };
  }

  async criarEstacionamento(userId: string, eventoId: string, body: Record<string, any>) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    if (!body.nome?.trim()) throw new BadRequestException('Nome é obrigatório');
    if (!['gratis', 'fixo', 'por_tempo'].includes(body.cobraModo)) throw new BadRequestException('Modo de cobrança inválido');

    const existentes = await this.prisma.estacionamento.findMany({
      where: { eventId: eventoId, ativo: true },
      select: { nome: true },
    });
    if (existentes.some((e) => e.nome === body.nome.trim())) {
      throw new BadRequestException(`Já existe um estacionamento chamado "${body.nome.trim()}".`);
    }

    const criado = await this.prisma.estacionamento.create({
      data: {
        eventId: eventoId,
        nome: body.nome.trim(),
        cobraModo: body.cobraModo,
        precoFixo: body.precoFixo ?? null,
        precoPrimeiraHora: body.precoPrimeiraHora ?? null,
        precoHoraAdicional: body.precoHoraAdicional ?? null,
        tetoDiario: body.tetoDiario ?? null,
        toleranciaMinutos: body.toleranciaMinutos ?? 10,
        controlaSaida: body.controlaSaida ?? true,
        vagasTotais: body.vagasTotais ?? null,
        createdBy: userId,
      },
    });
    return { ok: true, estacionamento: criado };
  }

  async atualizarEstacionamento(userId: string, eventoId: string, estacionamentoId: string, body: Record<string, any>) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const data: Record<string, unknown> = {};
    if (body.nome !== undefined) data.nome = body.nome.trim();
    if (body.cobraModo !== undefined) data.cobraModo = body.cobraModo;
    if (body.precoFixo !== undefined) data.precoFixo = body.precoFixo;
    if (body.precoPrimeiraHora !== undefined) data.precoPrimeiraHora = body.precoPrimeiraHora;
    if (body.precoHoraAdicional !== undefined) data.precoHoraAdicional = body.precoHoraAdicional;
    if (body.tetoDiario !== undefined) data.tetoDiario = body.tetoDiario;
    if (body.toleranciaMinutos !== undefined) data.toleranciaMinutos = body.toleranciaMinutos;
    if (body.controlaSaida !== undefined) data.controlaSaida = body.controlaSaida;
    if (body.vagasTotais !== undefined) data.vagasTotais = body.vagasTotais;
    if (body.ativo !== undefined) data.ativo = body.ativo;

    await this.prisma.estacionamento.updateMany({ where: { id: estacionamentoId, eventId: eventoId }, data });
    return { ok: true };
  }

  async removerEstacionamento(userId: string, eventoId: string, estacionamentoId: string) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const aberta = await this.prisma.estacionamentoSessao.findFirst({
      where: { estacionamentoId, status: 'aberto' },
      select: { id: true },
    });
    if (aberta) throw new BadRequestException('Existe veículo com sessão em aberto neste estacionamento.');

    await this.prisma.estacionamento.deleteMany({ where: { id: estacionamentoId, eventId: eventoId } });
    return { ok: true };
  }

  // ==== Portões ====

  async criarPortao(userId: string, eventoId: string, estacionamentoId: string, body: { nome?: string; tipo?: string }) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    if (!body.nome?.trim()) throw new BadRequestException('Nome é obrigatório');
    if (!['entrada', 'saida', 'ambos'].includes(body.tipo ?? '')) throw new BadRequestException('Tipo inválido');

    const estacionamento = await this.prisma.estacionamento.findFirst({
      where: { id: estacionamentoId, eventId: eventoId },
      select: { id: true },
    });
    if (!estacionamento) throw new NotFoundException('Estacionamento não encontrado');

    const criado = await this.prisma.estacionamentoPortao.create({
      data: { estacionamentoId, nome: body.nome.trim(), tipo: body.tipo! },
    });
    return { ok: true, portao: criado };
  }

  async atualizarPortao(
    userId: string,
    eventoId: string,
    estacionamentoId: string,
    portaoId: string,
    body: { nome?: string; tipo?: string; ativo?: boolean },
  ) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    const data: Record<string, unknown> = {};
    if (body.nome !== undefined) data.nome = body.nome.trim();
    if (body.tipo !== undefined) data.tipo = body.tipo;
    if (body.ativo !== undefined) data.ativo = body.ativo;

    await this.prisma.estacionamentoPortao.updateMany({ where: { id: portaoId, estacionamentoId }, data });
    return { ok: true };
  }

  async removerPortao(userId: string, eventoId: string, estacionamentoId: string, portaoId: string) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    await this.prisma.estacionamentoPortao.deleteMany({ where: { id: portaoId, estacionamentoId } });
    return { ok: true };
  }

  // ==== Operação (entrada/saída/sessões) ====

  async listSessoes(userId: string, eventoId: string, status: string) {
    if (!(await this.eventPermissions.hasEventPermission(userId, eventoId, ['estacionamento_entrada', 'estacionamento_saida']))) {
      throw new ForbiddenException('Sem permissão para este evento');
    }

    const estacionamentos = await this.prisma.estacionamento.findMany({ where: { eventId: eventoId }, select: { id: true } });
    const ids = estacionamentos.map((e) => e.id);
    if (ids.length === 0) return { sessoes: [] };

    const sessoes = await this.prisma.estacionamentoSessao.findMany({
      where: { estacionamentoId: { in: ids }, status },
      orderBy: { entradaEm: 'desc' },
      include: { estacionamento: { select: { nome: true } } },
    });
    return {
      sessoes: sessoes.map((s) => ({
        id: s.id,
        estacionamento_id: s.estacionamentoId,
        placa: s.placa,
        nome_condutor: s.nomeCondutor,
        telefone_condutor: s.telefoneCondutor,
        entrada_em: s.entradaEm,
        modelo: s.modelo,
        cor: s.cor,
        estacionamento: s.estacionamento,
      })),
    };
  }

  async entrada(userId: string, body: Record<string, any>) {
    if (!body.estacionamentoId || !body.placa?.trim() || !body.modelo?.trim() || !body.cor?.trim()) {
      throw new BadRequestException('Dados incompletos');
    }
    if (!body.telefoneCondutor?.trim() && !body.semWhatsapp) {
      throw new BadRequestException('Informe o WhatsApp do condutor ou confirme o registro sem ele');
    }

    const estacionamento = await this.prisma.estacionamento.findUnique({
      where: { id: body.estacionamentoId },
      include: { estacionamentoPortoes: true },
    });
    if (!estacionamento) throw new NotFoundException('Estacionamento não encontrado');

    if (!(await this.eventPermissions.hasEventPermission(userId, estacionamento.eventId, 'estacionamento_entrada'))) {
      throw new ForbiddenException('Sem permissão para este evento');
    }

    const portoes = estacionamento.estacionamentoPortoes;
    let portaoEntradaId: string | null = null;

    if (portoes.length > 0) {
      if (!body.portaoId) throw new BadRequestException('Selecione o portão de entrada');
      const portao = portoes.find((p) => p.id === body.portaoId);
      if (!portao || !portao.ativo || !['entrada', 'ambos'].includes(portao.tipo)) {
        throw new BadRequestException('Portão inválido para entrada');
      }
      const portaoRestrito = await this.eventPermissions.getStaffPortao(userId, estacionamento.eventId);
      if (portaoRestrito && portaoRestrito !== body.portaoId) {
        throw new ForbiddenException('Você só pode registrar entrada pelo seu portão designado');
      }
      portaoEntradaId = body.portaoId;
    }

    let valorCobrado: number | null = null;
    let formaPagamento: string | null = null;
    let caixaId: string | null = null;

    if (estacionamento.cobraModo === 'fixo') {
      const preco = Number(estacionamento.precoFixo ?? 0);
      if (preco > 0) {
        if (!body.formaPagamento) throw new BadRequestException('Selecione a forma de pagamento');
        if (body.formaPagamento === 'cortesia') {
          valorCobrado = 0;
          formaPagamento = 'cortesia';
        } else {
          if (!body.caixaId) throw new BadRequestException('Selecione o caixa para registrar o pagamento');
          valorCobrado = preco;
          formaPagamento = body.formaPagamento;
          caixaId = body.caixaId;
        }
      }
    }

    const rows = await this.prisma.$queryRaw<{ registrar_entrada_estacionamento: Record<string, any> | null }[]>`
      SELECT registrar_entrada_estacionamento(
        ${body.estacionamentoId}::uuid,
        ${body.placa.trim().toUpperCase()},
        ${body.nomeCondutor?.trim() || null},
        ${body.telefoneCondutor?.trim() || null},
        ${userId}::uuid,
        ${valorCobrado},
        ${formaPagamento},
        ${caixaId}::uuid,
        ${portaoEntradaId}::uuid,
        ${body.modelo?.trim() || null},
        ${body.cor?.trim() || null},
        ${body.cpfCondutor?.replace(/\D/g, '') || null}
      )
    `;
    const resultado = rows[0]?.registrar_entrada_estacionamento;

    if (resultado?.error === 'lotado') throw new ConflictException('Lotado — não há vagas disponíveis neste estacionamento.');
    if (resultado?.error === 'estacionamento_inativo') throw new BadRequestException('Estacionamento inativo');
    if (resultado?.error === 'estacionamento_nao_encontrado') throw new NotFoundException('Estacionamento não encontrado');
    if (!resultado?.sessao_id) throw new BadRequestException('Erro ao registrar entrada');

    // Best-effort — não aguarda nem bloqueia a resposta.
    void this.autosave.salvarVeiculoNaAutosave({
      placa: body.placa.trim().toUpperCase(),
      modelo: body.modelo.trim(),
      cor: body.cor.trim(),
    });

    // Ticket de estacionamento por WhatsApp — achado real (17/08/2026): o
    // formulário já EXIGIA o telefone (ou confirmação de "sem WhatsApp") mas
    // nada disparava de fato, o campo `estacionamento_emitido` só existia
    // preparado no enum do WhatsAppService. Reaproveita o mesmo `sessao_id`
    // que já vai pro QR impresso (ver imprimirTicketEstacionamento() no
    // AtendenteClient — usa `sessaoId` puro como conteúdo do QR, então dá
    // pra usar como `qrData` aqui sem precisar de token novo). Best-effort,
    // mesmo padrão do e-mail/WhatsApp de ingresso — nunca trava a entrada.
    if (body.telefoneCondutor?.trim()) {
      void this.notificarTicketEstacionamento({
        sessaoId: resultado.sessao_id,
        eventId: estacionamento.eventId,
        estacionamentoNome: estacionamento.nome,
        telefone: body.telefoneCondutor.trim(),
        nomeCondutor: body.nomeCondutor?.trim() || 'Cliente',
        placa: body.placa.trim().toUpperCase(),
        modelo: body.modelo?.trim() || '',
        cor: body.cor?.trim() || '',
      });
    }

    return { ok: true, sessaoId: resultado.sessao_id };
  }

  private async notificarTicketEstacionamento(params: {
    sessaoId: string; eventId: string; estacionamentoNome: string; telefone: string;
    nomeCondutor: string; placa: string; modelo: string; cor: string;
  }): Promise<void> {
    try {
      const evento = await this.prisma.event.findUnique({
        where: { id: params.eventId },
        select: { title: true, dateStart: true, venueName: true, city: true, state: true },
      });
      // Achado real (17/08/2026, produção): a Boot Whats JÁ tinha o
      // template de "estacionamento_emitido" pronto do lado deles — não
      // precisou combinar nada, só rejeitou (422 VALIDATION_ERROR) em cada
      // tentativa reclamando de um campo obrigatório por vez (a mensagem
      // de erro só lista o que falta, não o conjunto completo). Descoberto
      // por tentativa: 1ª rejeição pediu cor/modelo/horario (tinha mandado
      // `veiculo` combinado e não tinha `horario`); ao corrigir isso e
      // tirar `data` achando redundante, a 2ª rejeição pediu `data` de
      // volta — ou seja, os 4 (`data`, `cor`, `modelo`, `horario`) são
      // TODOS obrigatórios ao mesmo tempo. Ver docs/boot-whats-details.md.
      const horario = new Date().toLocaleString('pt-BR', {
        day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
      });
      await this.whatsapp.enviar({
        to: params.telefone,
        recipientName: params.nomeCondutor,
        type: 'estacionamento_emitido',
        qrData: params.sessaoId,
        details: {
          nome_evento: evento?.title ?? 'Evento',
          data: evento?.dateStart?.toISOString() ?? '',
          local: params.estacionamentoNome,
          cidade: evento?.city ?? '',
          estado: evento?.state ?? '',
          placa: params.placa,
          modelo: params.modelo,
          cor: params.cor,
          horario,
        },
      });
    } catch (err) {
      this.logger.error('[notificarTicketEstacionamento] falha ao enviar whatsapp', err as Error);
    }
  }

  async saida(userId: string, body: Record<string, any>) {
    if (!body.sessaoId) throw new BadRequestException('sessaoId obrigatório');

    const sessao = await this.prisma.estacionamentoSessao.findUnique({
      where: { id: body.sessaoId },
      include: { estacionamento: { include: { estacionamentoPortoes: true } } },
    });
    if (!sessao) throw new NotFoundException('Sessão não encontrada');
    if (sessao.status !== 'aberto') throw new BadRequestException('Sessão já encerrada');

    const config = sessao.estacionamento;
    if (!config) throw new NotFoundException('Estacionamento não encontrado');

    if (!(await this.eventPermissions.hasEventPermission(userId, config.eventId, 'estacionamento_saida'))) {
      throw new ForbiddenException('Sem permissão para este evento');
    }

    const portoes = config.estacionamentoPortoes;
    let portaoSaidaId: string | null = null;

    if (portoes.length > 0) {
      if (!body.portaoId) throw new BadRequestException('Selecione o portão de saída');
      const portao = portoes.find((p) => p.id === body.portaoId);
      if (!portao || !portao.ativo || !['saida', 'ambos'].includes(portao.tipo)) {
        throw new BadRequestException('Portão inválido para saída');
      }
      const portaoRestrito = await this.eventPermissions.getStaffPortao(userId, config.eventId);
      if (portaoRestrito && portaoRestrito !== body.portaoId) {
        throw new ForbiddenException('Você só pode registrar saída pelo seu portão designado');
      }
      portaoSaidaId = body.portaoId;
    }

    const saidaEm = new Date();
    let valorCobrado: number | null = null;
    let status: 'pago' | 'encerrado' = 'encerrado';
    let caixaId: string | null = null;
    let formaPagamento: string | null = null;
    let jaCobradoNaEntrada = false;

    if (config.cobraModo === 'fixo') {
      jaCobradoNaEntrada = true;
      valorCobrado = Number(sessao.valorCobrado ?? 0);
      status = valorCobrado > 0 ? 'pago' : 'encerrado';
    } else if (config.cobraModo === 'gratis') {
      valorCobrado = null;
      status = 'encerrado';
    } else if (body.formaPagamento === 'cortesia') {
      valorCobrado = 0;
      status = 'encerrado';
      formaPagamento = 'cortesia';
      caixaId = body.caixaId ?? null;
    } else {
      const valor = calcularValorEstacionamento(
        {
          cobra_modo: config.cobraModo as 'gratis' | 'fixo' | 'por_tempo',
          preco_fixo: config.precoFixo ? Number(config.precoFixo) : null,
          preco_primeira_hora: config.precoPrimeiraHora ? Number(config.precoPrimeiraHora) : null,
          preco_hora_adicional: config.precoHoraAdicional ? Number(config.precoHoraAdicional) : null,
          teto_diario: config.tetoDiario ? Number(config.tetoDiario) : null,
          tolerancia_minutos: config.toleranciaMinutos,
        },
        sessao.entradaEm,
        saidaEm,
      );
      if (valor > 0 && !body.caixaId) throw new BadRequestException('Selecione o caixa para registrar o pagamento');
      if (body.caixaId) {
        const caixa = await this.prisma.caixa.findUnique({ where: { id: body.caixaId }, select: { id: true, eventoId: true, status: true } });
        if (!caixa || caixa.eventoId !== config.eventId || caixa.status !== 'aberto') throw new BadRequestException('Caixa inválido ou fechado');
      }
      valorCobrado = valor;
      status = 'pago';
      caixaId = body.caixaId ?? null;
      formaPagamento = body.formaPagamento ?? 'dinheiro';
    }

    await this.prisma.estacionamentoSessao.update({
      where: { id: body.sessaoId },
      data: jaCobradoNaEntrada
        ? { saidaEm, status, portaoSaidaId }
        : { saidaEm, valorCobrado, formaPagamento, caixaId, status, portaoSaidaId },
    });

    return { ok: true, valorCobrado, status };
  }

  async placaLookup(placa: string) {
    const veiculo = await this.autosave.buscarVeiculoPorPlaca(placa);
    if (!veiculo) return { found: false };
    return { found: true, modelo: veiculo.modelo, cor: veiculo.cor };
  }

  async abrirCaixa(userId: string, eventoId: string, body: Record<string, any>) {
    if (!(await this.eventPermissions.isEventOwner(userId, eventoId))) throw new ForbiddenException('Sem permissão');

    if (!body.nome?.trim()) throw new BadRequestException('Nome do caixa é obrigatório');

    let estacionamentoId: string | null = null;
    if (body.estacionamentoId) {
      const est = await this.prisma.estacionamento.findFirst({
        where: { id: body.estacionamentoId, eventId: eventoId },
        select: { id: true },
      });
      if (!est) throw new NotFoundException('Estacionamento não encontrado neste evento');
      estacionamentoId = body.estacionamentoId;
    }

    const abertos = await this.prisma.caixa.findMany({
      where: { eventoId, status: 'aberto' },
      select: { nome: true, operadorId: true },
    });
    if (abertos.some((c) => c.nome === body.nome.trim())) {
      throw new BadRequestException(`Já existe um caixa aberto chamado "${body.nome.trim()}".`);
    }

    let operadorId: string | null = null;
    if (body.operadorEmailOuCodigo?.trim()) {
      const busca = body.operadorEmailOuCodigo.trim();
      if (busca.toUpperCase().startsWith('T7-')) {
        const perfil = await this.prisma.profile.findFirst({ where: { userCode: busca.toUpperCase() }, select: { id: true } });
        operadorId = perfil?.id ?? null;
      } else {
        const rows = await this.prisma.$queryRaw<{ find_user_id_by_email: string | null }[]>`
          SELECT find_user_id_by_email(${busca})
        `;
        operadorId = rows[0]?.find_user_id_by_email ?? null;
      }
      if (!operadorId) throw new NotFoundException('Operador não encontrado. Verifique o email ou código T7-USR.');

      if (!(await this.eventPermissions.hasEventPermission(operadorId, eventoId, ['estacionamento_entrada', 'estacionamento_saida']))) {
        throw new BadRequestException(
          'Esse usuário ainda não é equipe ativa com permissão de estacionamento neste evento. Convide-o primeiro pela equipe do evento.',
        );
      }
    }

    if (operadorId && abertos.some((c) => c.operadorId === operadorId)) {
      throw new BadRequestException('Esse operador já tem um caixa aberto neste evento.');
    }

    const caixa = await this.prisma.caixa.create({
      data: {
        eventoId,
        nome: body.nome.trim(),
        fundoInicial: body.fundoInicial ?? 0,
        ingressosAlocados: 0,
        operadorId,
        createdBy: userId,
        estacionamentoId,
      },
    });

    return { ok: true, caixa };
  }
}
