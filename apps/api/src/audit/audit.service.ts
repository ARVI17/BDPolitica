import { Injectable } from "@nestjs/common";
import { randomUUID } from "crypto";
import { PrismaService } from "../prisma/prisma.service";

export type AuditEventInput = {
  tenantId: string;
  actorUserId?: string | null;
  actorType?: "USER" | "SYSTEM";
  eventCategory: "AUTH" | "RBAC" | "SECURITY" | "CRUD";
  eventName: string;
  targetTable?: string;
  targetId?: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  payload?: Record<string, unknown>;
};

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(input: AuditEventInput): Promise<void> {
    await this.prisma.auditEvent.create({
      data: {
        id: randomUUID(),
        tenantId: input.tenantId,
        actorUserId: input.actorUserId ?? null,
        actorType: input.actorType ?? "USER",
        eventCategory: input.eventCategory,
        eventName: input.eventName,
        targetTable: input.targetTable ?? null,
        targetId: input.targetId ?? null,
        requestId: input.requestId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        payload: (input.payload ?? undefined) as never
      }
    });
  }
}
