import { Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class TenantsService {
  constructor(private readonly prisma: PrismaService) {}

  async getTenantById(tenantId: string) {
    const tenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenantId
      },
      select: {
        id: true,
        code: true,
        name: true,
        description: true,
        isActive: true
      }
    });

    if (!tenant) {
      throw new NotFoundException("Tenant no encontrado");
    }

    return tenant;
  }
}
