import { Module } from '@nestjs/common';
import { EventosModule } from '../eventos/eventos.module';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';

@Module({
  imports: [EventosModule],
  controllers: [EventsController],
  providers: [EventsService],
})
export class EventsModule {}
