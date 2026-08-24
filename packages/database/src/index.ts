import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated-client/index.js";

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL || "postgresql://dummy:dummy@localhost:5432/dummy";

  // Mask sensitive info for logging
  const maskedUrl = url.replace(/:.+@/, ":****@");
  console.info(`[PRISMA] DATABASE_URL: ${maskedUrl}`);

  const adapter = new PrismaPg({
    connectionString: url,
  });

  return new PrismaClient({ adapter });
};

declare global {
  var prismaGlobal: undefined | ReturnType<typeof prismaClientSingleton>;
}

export const prisma = globalThis.prismaGlobal ?? prismaClientSingleton();

if (process.env.NODE_ENV !== "production") {
  globalThis.prismaGlobal = prisma;
}

export * from "../generated-client/index.js";
