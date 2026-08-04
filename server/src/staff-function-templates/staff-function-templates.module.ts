import { Module } from '@nestjs/common';
import { StaffFunctionTemplatesController } from './staff-function-templates.controller';

@Module({
  controllers: [StaffFunctionTemplatesController],
})
export class StaffFunctionTemplatesModule {}
