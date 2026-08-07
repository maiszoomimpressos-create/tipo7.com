import { Injectable, MessageEvent } from '@nestjs/common';
import { Observable, Subject, interval, merge } from 'rxjs';
import { filter, map } from 'rxjs/operators';

interface StreamEvent {
  eventoId: string;
  event: string;
  payload: string | object;
}

// Fase 7.3 — substitui o canal Realtime da Supabase (`bilheteria-${eventoId}`,
// broadcast) usado pelo par Bilheteiro (emissor) → Segunda Tela (receptor).
// Emissor único por evento, N receptores. Tudo dentro do processo, via
// RxJS Subject — sem fila/pubsub externo, igual ao plano original (não
// vale a pena por causa de 1 emissor : poucos receptores por evento).
//
// Limitação conhecida: se o serviço rodar com mais de uma réplica no Swarm,
// um broadcast só chega às segunda-telas conectadas na MESMA réplica que
// recebeu o POST. Hoje o server roda com 1 réplica só (ver EasyPanel) — se
// isso mudar, este serviço precisa virar pubsub real (Redis, por ex).
@Injectable()
export class BilheteriaStreamService {
  private readonly subject = new Subject<StreamEvent>();

  emit(eventoId: string, event: string, payload: string | object | null | undefined): void {
    this.subject.next({ eventoId, event, payload: payload ?? {} });
  }

  stream(eventoId: string): Observable<MessageEvent> {
    const eventos$ = this.subject.asObservable().pipe(
      filter((m) => m.eventoId === eventoId),
      map((m): MessageEvent => ({ type: m.event, data: m.payload })),
    );

    // Heartbeat a cada 20s — mantém a conexão viva atrás de proxies
    // (Traefik/Next.js rewrite) que podem derrubar streams HTTP ociosos.
    // O front-end nunca escuta o evento 'heartbeat', então é inofensivo.
    const heartbeat$ = interval(20_000).pipe(map((): MessageEvent => ({ type: 'heartbeat', data: {} })));

    return merge(eventos$, heartbeat$);
  }
}
