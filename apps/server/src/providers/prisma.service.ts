import { Injectable, OnModuleInit, OnModuleDestroy } from "@nestjs/common";
import { PrismaClient } from "@IRIS/database";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * NestJS injectable database service providing access to the Prisma client and managing connection lifecycle.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  constructor() {
    const url = process.env.DATABASE_URL
    const adapter = new PrismaPg({ connectionString: url });
    super({ adapter });
  }

  /**
   * Connects to the database upon module initialization.
   */
  public async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
    } catch (error) {
      console.warn("[PRISMA] Database connection deferred:", error);
    }
  }

  /**
   * Disconnects from the database upon application shutdown.
   */
  public async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
