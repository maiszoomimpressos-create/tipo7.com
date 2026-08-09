import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from './admin.service';

interface BuscaRow {
  ticket_id:          string;
  qr_token:           string;
  ticket_status:      string;
  slot_number:        number;
  validated_at:       Date | null;
  order_id:           string;
  order_status:       string;
  total:              string;
  payment_method:     string | null;
  gateway:            string;
  mp_payment_id:      string | null;
  pagbank_charge_id:  string | null;
  order_created_at:   Date;
  buyer_id:           string | null;
  buyer_name:         string | null;
  buyer_email:        string | null;
  buyer_cpf:          string | null;
  buyer_phone:        string | null;
  event_id:           string;
  event_title:        string | null;
  ticket_type_name:   string | null;
  portador_name:      string | null;
  portador_cpf:       string | null;
  portador_email:     string | null;
  portador_phone:     string | null;
}

// Porte 09/08/2026 — pedido do usuário: ferramenta de suporte em
// Admin > Players > Ingressos pra achar rápido comprador/evento/portador
// de um ingresso, sem precisar de query SQL direto no banco toda vez que
// alguém reporta um problema. Busca livre por CPF, e-mail, nome, título
// do evento, ou os IDs exatos (ticket, pedido, pagamento MP).
@Injectable()
export class AdminIngressosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly admin: AdminService,
  ) {}

  async buscar(userId: string, q: string) {
    await this.admin.requirePerm(userId, 'gerenciar_promotores');

    const like = `%${q}%`;
    const digits = q.replace(/\D/g, '');

    const rows = await this.prisma.$queryRaw<BuscaRow[]>`
      SELECT
        t.id as ticket_id, t.qr_token, t.status as ticket_status, t.slot_number, t.validated_at,
        o.id as order_id, o.status as order_status, o.total, o.payment_method, o.gateway,
        o.mp_payment_id, o.pagbank_charge_id, o.created_at as order_created_at,
        buyer.id as buyer_id, buyer.full_name as buyer_name, buyer.email as buyer_email,
        buyer.cpf as buyer_cpf, buyer.phone as buyer_phone,
        e.id as event_id, e.title as event_title,
        et.name as ticket_type_name,
        th.full_name as portador_name, th.cpf as portador_cpf, th.email as portador_email, th.phone as portador_phone
      FROM tickets t
      JOIN order_items oi ON oi.id = t.order_item_id
      JOIN orders o ON o.id = t.order_id
      LEFT JOIN profiles buyer ON buyer.id = o.user_id
      JOIN events e ON e.id = o.event_id
      LEFT JOIN event_tickets et ON et.id = oi.ticket_id
      LEFT JOIN ticket_holders th ON th.order_item_id = oi.id AND th.slot_number = t.slot_number
      WHERE
        t.id::text = ${q} OR
        t.qr_token = ${q} OR
        o.id::text = ${q} OR
        o.mp_payment_id = ${q} OR
        o.pagbank_charge_id = ${q} OR
        e.id::text = ${q} OR
        buyer.id::text = ${q} OR
        (buyer.email ILIKE ${like}) OR
        (buyer.full_name ILIKE ${like}) OR
        (${digits} <> '' AND buyer.cpf = ${digits}) OR
        (${digits} <> '' AND th.cpf = ${digits}) OR
        (th.email ILIKE ${like}) OR
        (th.full_name ILIKE ${like}) OR
        (e.title ILIKE ${like})
      ORDER BY o.created_at DESC
      LIMIT 100
    `;

    return rows.map((r) => ({
      ticket_id:         r.ticket_id,
      qr_token:          r.qr_token,
      ticket_status:     r.ticket_status,
      slot_number:       r.slot_number,
      validated_at:      r.validated_at,
      order_id:          r.order_id,
      order_status:      r.order_status,
      total:             Number(r.total),
      payment_method:    r.payment_method,
      gateway:           r.gateway,
      mp_payment_id:     r.mp_payment_id,
      pagbank_charge_id: r.pagbank_charge_id,
      order_created_at:  r.order_created_at,
      comprador: r.buyer_id ? {
        id: r.buyer_id, nome: r.buyer_name, email: r.buyer_email, cpf: r.buyer_cpf, telefone: r.buyer_phone,
      } : null,
      evento: { id: r.event_id, titulo: r.event_title },
      tipo_ingresso: r.ticket_type_name,
      portador: r.portador_name || r.portador_cpf ? {
        nome: r.portador_name, cpf: r.portador_cpf, email: r.portador_email, telefone: r.portador_phone,
      } : null,
    }));
  }
}
