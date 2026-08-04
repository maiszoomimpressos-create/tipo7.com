import { BadGatewayException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

interface GoogleAutocompleteSuggestion {
  placePrediction?: {
    placeId?: string;
    text?: { text?: string };
    structuredFormat?: { mainText?: { text?: string }; secondaryText?: { text?: string } };
  };
}

interface GoogleDetailsResponse {
  addressComponents?: { types: string[]; longText: string; shortText: string }[];
  formattedAddress?: string;
  location?: { latitude?: number; longitude?: number };
}

@Injectable()
export class PlacesService {
  constructor(private readonly prisma: PrismaService) {}

  async autocomplete(q: string, cidade?: string, estado?: string) {
    const venues = await this.prisma.venue.findMany({
      where: {
        name: { contains: q, mode: 'insensitive' },
        ...(cidade ? { city: { contains: cidade, mode: 'insensitive' } } : {}),
      },
      select: {
        id: true,
        name: true,
        street: true,
        streetNumber: true,
        neighborhood: true,
        city: true,
        state: true,
        zipCode: true,
        complement: true,
        lat: true,
        lng: true,
        capacity: true,
        hasParking: true,
        parkingSpots: true,
      },
      take: 5,
    });

    const sugestoesVenue = venues.map((v) => ({
      origem: 'venue' as const,
      placeId: '',
      venueId: v.id,
      nomePrincipal: v.name,
      nomeSecundario: [v.city, v.state].filter(Boolean).join(' - '),
      zipCode: v.zipCode ?? '',
      street: v.street ?? '',
      streetNumber: v.streetNumber ?? '',
      neighborhood: v.neighborhood ?? '',
      city: v.city ?? '',
      state: v.state ?? '',
      complement: v.complement ?? '',
      lat: v.lat,
      lng: v.lng,
      capacity: v.capacity,
      hasParking: v.hasParking,
      parkingSpots: v.parkingSpots,
    }));

    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) return { suggestions: sugestoesVenue };

    const input = cidade ? `${q}, ${cidade}${estado ? ' - ' + estado : ''}` : q;
    const res = await fetch('https://places.googleapis.com/v1/places:autocomplete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key },
      body: JSON.stringify({ input, languageCode: 'pt-BR', regionCode: 'BR' }),
    });

    if (!res.ok) return { suggestions: sugestoesVenue };

    const data = (await res.json()) as { suggestions?: GoogleAutocompleteSuggestion[] };
    const sugestoesGoogle = (data.suggestions ?? []).map((s) => ({
      origem: 'google' as const,
      placeId: s.placePrediction?.placeId ?? '',
      texto: s.placePrediction?.text?.text ?? '',
      nomePrincipal: s.placePrediction?.structuredFormat?.mainText?.text ?? '',
      nomeSecundario: s.placePrediction?.structuredFormat?.secondaryText?.text ?? '',
    }));

    return { suggestions: [...sugestoesVenue, ...sugestoesGoogle] };
  }

  async details(placeId: string) {
    const key = process.env.GOOGLE_PLACES_API_KEY;
    if (!key) throw new InternalServerErrorException('API key não configurada');

    const fields = 'addressComponents,formattedAddress,location';
    const res = await fetch(`https://places.googleapis.com/v1/places/${placeId}?languageCode=pt-BR`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': fields },
    });

    if (!res.ok) throw new BadGatewayException('Erro ao buscar detalhes');

    const data = (await res.json()) as GoogleDetailsResponse;
    const comps = data.addressComponents ?? [];
    const get = (type: string) => comps.find((c) => c.types.includes(type))?.longText ?? '';
    const getShort = (type: string) => comps.find((c) => c.types.includes(type))?.shortText ?? '';

    return {
      cep: get('postal_code').replace(/\D/g, ''),
      rua: get('route') || get('street_address'),
      numero: get('street_number'),
      bairro: get('sublocality_level_1') || get('sublocality') || get('neighborhood'),
      cidade: get('administrative_area_level_2') || get('locality'),
      estado: getShort('administrative_area_level_1'),
      enderecoCompleto: data.formattedAddress ?? '',
      lat: data.location?.latitude ?? null,
      lng: data.location?.longitude ?? null,
    };
  }
}
