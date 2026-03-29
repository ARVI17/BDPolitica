import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger("DAO");
  private readonly logQueries = process.env.DAO_LOG_QUERIES !== "false";
  private readonly logQueryParams = process.env.DAO_LOG_QUERY_PARAMS === "true";
  private readonly slowQueryMs = Number(process.env.DAO_SLOW_QUERY_MS ?? "300");

  constructor() {
    super();
    this.registerDaoMiddleware();
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
    this.logger.log("Prisma conectado.");
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log("Prisma desconectado.");
  }

  private registerDaoMiddleware(): void {
    this.$use(
      // Prisma no expone tipos de middleware estables en este cliente generado.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      async (params: any, next: any): Promise<unknown> => {
        const startedAt = Date.now();
        const context = this.readDaoContext(params as unknown);

        try {
          const result = await next(params);
          const durationMs = Date.now() - startedAt;

          if (this.logQueries) {
            const line = `[DAO] ${context.model}.${context.action} (${durationMs}ms)`;

            if (durationMs >= this.slowQueryMs) {
              this.logger.warn(line);
            } else {
              this.logger.debug(line);
            }

            if (this.logQueryParams) {
              this.logger.debug(
                `[DAO-PARAMS] args=${JSON.stringify(context.args ?? {})}`
              );
            }
          }

          return result;
        } catch (error) {
          const durationMs = Date.now() - startedAt;
          const message = error instanceof Error ? error.message : String(error);
          const stack = error instanceof Error ? error.stack : undefined;

          this.logger.error(
            `[DAO-ERROR] ${context.model}.${context.action} fallo en ${durationMs}ms: ${message}`,
            stack
          );
          throw error;
        }
      }
    );
  }

  private readDaoContext(params: unknown): {
    model: string;
    action: string;
    args: unknown;
  } {
    if (typeof params !== "object" || params === null) {
      return {
        model: "unknown",
        action: "unknown",
        args: undefined
      };
    }

    const objectParams = params as {
      model?: unknown;
      action?: unknown;
      args?: unknown;
    };

    return {
      model: typeof objectParams.model === "string" ? objectParams.model : "raw",
      action:
        typeof objectParams.action === "string" ? objectParams.action : "unknown",
      args: objectParams.args
    };
  }
}
