import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface StreamEvent {
  caixaId: string;
  event: string;
  payload: string | object;
}

// Fase 7.3 — substitui o canal Realtime da Supabase (`bilheteria-${eventoId}`,
// broadcast) usado pelo par Bilheteiro (emissor) → Segunda Tela (receptor).
// Escopo por CAIXA, não por evento (mudança 09/08/2026, pedido do usuário) —
// achado real: com 2+ caixas vendendo o mesmo evento ao mesmo tempo, uma
// Segunda Tela por evento misturava as vendas dos dois caixas na mesma
// tela. Escopar por caixa também resolve de graça o caso de caixa
// compartilhado (evento pai + Tenda no mesmo caixa) — a Segunda Tela só
// se importa com o que passa POR AQUELE CAIXA, não com qual evento
// específico cada ingresso pertence.
//
// Emissor único por caixa, N receptores. Tudo dentro do processo, via
// RxJS Subject — sem fila/pubsub externo (não vale a pena pra 1 emissor :
// poucos receptores por caixa).
//
// Limitação conhecida: se o serviço rodar com mais de uma réplica no Swarm,
// um broadcast só chega às segunda-telas conectadas na MESMA réplica que
// recebeu o POST. Hoje o server roda com 1 réplica só (ver EasyPanel) — se
// isso mudar, este serviço precisa virar pubsub real (Redis, por ex).
@Injectable()
export class BilheteriaStreamService {
  private readonly subject = new Subject<StreamEvent>();

  emit(caixaId: string, event: string, payload: string | object | null | undefined): void {
    this.subject.next({ caixaId, event, payload: payload ?? {} });
  }

  stream(caixaId: string): Observable<MessageEvent> {
    const eventos$ = this.subject.asObservable().pipe(
      filter((m) => m.caixaId === caixaId),
      map((m): MessageEvent => ({ type: m.event, data: m.payload })),
    );

    // Heartbeat a cada 20s — mantém a conexão viva atrás de proxies
    // (Traefik/Next.js rewrite) que podem derrubar streams HTTP ociosos.
    // O front-end nunca escuta o evento 'heartbeat', então é inofensivo.
    const heartbeat$ = interval(20_000).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: {} })));

    return merge(eventos$, heartbeat$);
  }
}
