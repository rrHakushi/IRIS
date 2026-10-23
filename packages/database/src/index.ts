import postgres from "@prisma/orm-postgres/runtime";
import { contractFromJson } from "@prisma/orm-postgres/static";
import type { Contract } from "./contract.js";
import contractJson from "./contract.json" with { type: "json" };

export const contract = contractFromJson<Contract>(contractJson);

export type PrismaClient = ReturnType<typeof postgres<Contract>>;

const url =
  (typeof Bun !== "undefined" ? Bun.env.DATABASE_URL : process.env.DATABASE_URL) ||
  "postgresql://dummy:dummy@localhost:5432/dummy";

// Mask sensitive info for logging
const maskedUrl = url.replace(/:.+@/, ":****@");
console.info(`[PRISMA] DATABASE_URL: ${maskedUrl}`);

declare global {
  var prismaGlobal: undefined | PrismaClient;
}

export const prisma: PrismaClient =
  globalThis.prismaGlobal ??
  postgres({
    contract,
    url,
  });

export const db = prisma;

if (
  (typeof Bun !== "undefined" ? Bun.env.NODE_ENV : process.env.NODE_ENV) !==
  "production"
) {
  globalThis.prismaGlobal = prisma;
}

// Re-export query combinators
export { and, or, not } from "@prisma/orm-postgres/orm-client";

// Re-export model & query type helpers
export type { Models } from "./contract.js";
export type { Scalars, Shape } from "@prisma/orm-postgres/family-contract/types";
export type { ResultType } from "@prisma/orm-postgres/components/runtime";

// Enum types extracted from the emitted contract
type PublicEnums = Contract["domain"]["namespaces"]["public"]["enum"];
export type EnumValues<E extends keyof PublicEnums> =
  PublicEnums[E]["members"][number]["value"];

export type ActivityType = EnumValues<"ActivityType">;
export type MediaType = EnumValues<"MediaType">;
export type FavoriteType = EnumValues<"FavoriteType">;
export type RelationType = EnumValues<"RelationType">;
export type NotificationType = EnumValues<"NotificationType">;
export type NotificationPriority = EnumValues<"NotificationPriority">;
export type NotificationActionStatus = EnumValues<"NotificationActionStatus">;
export type ConnectionProvider = EnumValues<"ConnectionProvider">;
export type ConnectionAuthType = EnumValues<"ConnectionAuthType">;
export type ConnectionStatus = EnumValues<"ConnectionStatus">;
export type PassCipherType = EnumValues<"PassCipherType">;
export type PassRepromptType = EnumValues<"PassRepromptType">;
export type SshKeyType = EnumValues<"SshKeyType">;
export type FriendRequestStatus = EnumValues<"FriendRequestStatus">;
export type ReviewVoteType = EnumValues<"ReviewVoteType">;
export type RecommendationVoteType = EnumValues<"RecommendationVoteType">;
export type StaffRole = EnumValues<"StaffRole">;
export type CharacterRole = EnumValues<"CharacterRole">;
export type AnimeStatus = EnumValues<"AnimeStatus">;
export type AnimeSeason = EnumValues<"AnimeSeason">;
export type AnimeSource = EnumValues<"AnimeSource">;
export type AnimeFormat = EnumValues<"AnimeFormat">;
export type EpisodeType = EnumValues<"EpisodeType">;
export type MangaFormat = EnumValues<"MangaFormat">;
export type MangaStatus = EnumValues<"MangaStatus">;
export type MovieStatus = EnumValues<"MovieStatus">;
export type TvStatus = EnumValues<"TvStatus">;
export type BookStatus = EnumValues<"BookStatus">;
export type GameStatus = EnumValues<"GameStatus">;
export type MusicType = EnumValues<"MusicType">;
export type MusicStatus = EnumValues<"MusicStatus">;
export type AnimeListStatus = EnumValues<"AnimeListStatus">;
export type MangaListStatus = EnumValues<"MangaListStatus">;
export type MovieListStatus = EnumValues<"MovieListStatus">;
export type TvListStatus = EnumValues<"TvListStatus">;
export type GameListStatus = EnumValues<"GameListStatus">;
export type BookListStatus = EnumValues<"BookListStatus">;
export type MusicListStatus = EnumValues<"MusicListStatus">;

// Helper utilities
export async function countOf(collection: {
  aggregate: (fn: (agg: any) => any) => Promise<any>;
}): Promise<number> {
  const result = await collection.aggregate((a) => ({ count: a.count() }));
  return result?.count ?? 0;
}

export function toDate(val: unknown): Date {
  if (!val) return new Date(0);
  if (val instanceof Date) return val;
  return new Date(String(val));
}

// Legacy Prisma compatibility namespace
export const Prisma = {
  JsonNull: null,
  DbNull: null,
};

export namespace Prisma {
  export type InputJsonValue = any;
  export type JsonValue = any;
  export type NullableJsonNullValueInput = typeof Prisma.JsonNull;
}

export type { Contract };
export type * from "./contract.js";
