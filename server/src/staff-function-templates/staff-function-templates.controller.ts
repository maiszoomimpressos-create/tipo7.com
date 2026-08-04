import { Controller, Get } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Controller('staff-function-templates')
export class StaffFunctionTemplatesController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    const templates = await this.prisma.staffFunctionTemplate.findMany({
      where: { active: true },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        name: true,
        staffFunctionTemplatePermissions: { select: { permission: true } },
      },
    });

    return {
      templates: templates.map(({ staffFunctionTemplatePermissions, ...rest }) => ({
        ...rest,
        staff_function_template_permissions: staffFunctionTemplatePermissions,
      })),
    };
  }
}
