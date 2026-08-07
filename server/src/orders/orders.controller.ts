import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { SupabaseJwtGuard } from '../auth/guards/supabase-jwt.guard';
import type { AuthenticatedUser } from '../auth/strategies/supabase-jwt.strategy';
import { OrdersService } from './orders.service';

@UseGuards(SupabaseJwtGuard)
@Controller('orders')
export class OrdersController {
  constructor(private readonly orders: OrdersService) {}

  @Get('minhas')
  minhas(@CurrentUser() user: AuthenticatedUser) {
    return this.orders.minhas(user.id);
  }
}
