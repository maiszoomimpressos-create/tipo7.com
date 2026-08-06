import { Controller, Get } from '@nestjs/common';
import { PlatformSettingsService } from './platform-settings.service';

@Controller('platform-settings')
export class PlatformSettingsController {
  constructor(private readonly settings: PlatformSettingsService) {}

  @Get('public')
  getPublic() {
    return this.settings.getPublic();
  }
}
