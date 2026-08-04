import { BadRequestException, Controller, Get, Query, UseGuards } from '@nestjs/common';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import { PlacesService } from './places.service';

@UseGuards(SupabaseJwtGuard)
@Controller('places')
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get('autocomplete')
  async autocomplete(@Query('q') qParam?: string, @Query('cidade') cidade?: string, @Query('estado') estado?: string) {
    const q = qParam?.trim();
    if (!q || q.length < 2) return { suggestions: [] };
    return this.places.autocomplete(q, cidade?.trim(), estado?.trim());
  }

  @Get('details')
  async details(@Query('place_id') placeId?: string) {
    const id = placeId?.trim();
    if (!id) throw new BadRequestException('place_id obrigatório');
    return this.places.details(id);
  }
}
