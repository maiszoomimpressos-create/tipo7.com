import type { PagBankSplit } from './pagbank-token.service';

// Porte 1:1 de web/src/lib/pagbankPix.ts.
export interface PagBankPixParams {
  amount: number;
  description: string;
  referenceId: string;
  buyerName: string;
  buyerCpf: string;
  buyerEmail: string;
  notificationUrl: string;
  expiresAt: string;
  splits?: PagBankSplit;
}

export interface PagBankPixOrder {
  reference_id: string;
  customer: { name: string; email: string; tax_id: string };
  items: Array<{ name: string; quantity: number; unit_amount: number }>;
  qr_codes: Array<{ amount: { value: number }; expiration_date: string; splits?: PagBankSplit }>;
  notification_urls: string[];
}

export function buildPagBankPixOrder(params: PagBankPixParams): PagBankPixOrder {
  const { amount, description, referenceId, buyerName, buyerCpf, buyerEmail, notificationUrl, expiresAt, splits } = params;

  const centavos = Math.round(amount * 100);

  return {
    reference_id: referenceId,
    customer: {
      name: buyerName,
      email: buyerEmail,
      tax_id: buyerCpf,
    },
    items: [
      {
        name: description.slice(0, 255),
        quantity: 1,
        unit_amount: centavos,
      },
    ],
    qr_codes: [
      {
        amount: { value: centavos },
        expiration_date: expiresAt,
        ...(splits ? { splits } : {}),
      },
    ],
    notification_urls: [notificationUrl],
  };
}
