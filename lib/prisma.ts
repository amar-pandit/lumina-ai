import "server-only";

import { PrismaClient } from "@prisma/client";

const prismaGlobal = globalThis as typeof globalThis & { __luminaPrisma?: PrismaClient };

export const prisma = prismaGlobal.__luminaPrisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") {
  prismaGlobal.__luminaPrisma = prisma;
}

export function isDatabaseConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
