/**
 * Converts per-type media and list statuses to unified values, preserving all data:
 *   Media: RELEASED, RELEASING, UPCOMING, CANCELLED, HIATUS, UNKNOWN
 *   List:  IN_PROGRESS, ON_HOLD, DROPPED, COMPLETED, PLANNED
 *
 *   bun run db:unify-status -- --dry-run   # report only, rolls back
 *   bun run db:unify-status                # apply changes
 */
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("✘ DATABASE_URL environment variable is not defined!");
  process.exit(1);
}
const DRY_RUN = process.argv.includes("--dry-run");

// ---- Mapping tables (old value -> new value) -------------------------------
const MEDIA_MAP: Record<string, string> = {
  RELEASED: "RELEASED",
  FINISHED: "RELEASED",
  PUBLISHED: "RELEASED",
  ENDED: "RELEASED",
  RELEASING: "RELEASING",
  RETURNING_SERIES: "RELEASING",
  EARLY_ACCESS: "RELEASING",
  NOT_YET_RELEASED: "UPCOMING",
  UPCOMING: "UPCOMING",
  IN_PRODUCTION: "UPCOMING",
  POST_PRODUCTION: "UPCOMING",
  RUMORED: "UPCOMING",
  ANNOUNCED: "UPCOMING",
  IN_DEVELOPMENT: "UPCOMING",
  CANCELLED: "CANCELLED",
  CANCELED: "CANCELLED",
  HIATUS: "HIATUS",
  ON_HIATUS: "HIATUS",
  DELAYED: "HIATUS",
  UNKNOWN: "UNKNOWN",
};

const LIST_MAP: Record<string, string> = {
  PLANNING: "PLANNED",
  PLANNED: "PLANNED",
  WATCHING: "IN_PROGRESS",
  READING: "IN_PROGRESS",
  PLAYING: "IN_PROGRESS",
  LISTENING: "IN_PROGRESS",
  TRACKING: "IN_PROGRESS",
  CURRENT: "IN_PROGRESS",
  REPEATING: "IN_PROGRESS",
  IN_PROGRESS: "IN_PROGRESS",
  COMPLETED: "COMPLETED",
  ON_HOLD: "ON_HOLD",
  PAUSED: "ON_HOLD",
  DROPPED: "DROPPED",
};

const STATS_TABLES = ["Anime", "Manga", "Movie", "Tv", "Game", "Book", "Music", "Other"];

const q = (s: string) => `"${s.replace(/"/g, '""')}"`;
const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;

function caseExpr(col: string, map: Record<string, string>, fallback: string) {
  const whens = Object.entries(map)
    .map(([from, to]) => `WHEN ${lit(from)} THEN ${lit(to)}`)
    .join(" ");
  return `(CASE ${col}::text ${whens} ELSE ${lit(fallback)} END)`;
}

const client = new pg.Client({ connectionString });

async function convertColumn(
  table: string,
  column: string,
  map: Record<string, string>,
  fallbackDefault: string,
  fallbackValue: string,
) {
  const colInfo = await client.query(
    `SELECT column_default, udt_name FROM information_schema.columns
     WHERE table_schema='public' AND table_name=$1 AND column_name=$2`,
    [table, column],
  );
  if (colInfo.rowCount === 0) return;
  const { column_default: rawDefault, udt_name: udtName } = colInfo.rows[0];

  // Report transitions
  const dist = await client.query(
    `SELECT ${q(column)}::text AS v, count(*)::int AS n FROM ${q(table)} GROUP BY 1 ORDER BY 1`,
  );
  const summary = dist.rows
    .map((r) => `${r.v}→${map[r.v] ?? fallbackValue}(${r.n})`)
    .join(", ");
  console.log(`  ${table}.${column} [${udtName}]: ${summary || "(empty)"}`);

  // Drop existing status check constraints so updated values can be written
  const checks = await client.query(
    `SELECT conname FROM pg_constraint
     WHERE conrelid = $1::regclass AND contype = 'c' AND conname ILIKE '%status%'`,
    [`"${table}"`],
  );
  for (const c of checks.rows) {
    await client.query(`ALTER TABLE ${q(table)} DROP CONSTRAINT ${q(c.conname)}`);
  }

  // Update row values to unified status
  const cast = udtName === "ListStatus" ? '::"ListStatus"' : udtName === "MediaStatus" ? '::"MediaStatus"' : '';
  await client.query(
    `UPDATE ${q(table)} SET ${q(column)} = (${caseExpr(q(column), map, fallbackValue)})${cast}`,
  );

  // Update default value
  const oldDefault = rawDefault?.match(/^'([^']*)'/)?.[1];
  const newDefault = oldDefault ? (map[oldDefault] ?? fallbackDefault) : fallbackDefault;
  await client.query(
    `ALTER TABLE ${q(table)} ALTER COLUMN ${q(column)} SET DEFAULT (${lit(newDefault)}${cast})`,
  );
}

const MEDIA_TABLE_DEFS = [
  { table: "Anime", column: "status", default: "UNKNOWN" },
  { table: "Manga", column: "status", default: "UNKNOWN" },
  { table: "Tv", column: "status", default: "UNKNOWN" },
  { table: "Movie", column: "status", default: "RELEASED" },
  { table: "Game", column: "status", default: "UNKNOWN" },
  { table: "Book", column: "status", default: "UNKNOWN" },
  { table: "Music", column: "status", default: "RELEASED" },
];

const LIST_TABLE_DEFS = [
  { table: "AnimeList", column: "status", default: "PLANNED" },
  { table: "MangaList", column: "status", default: "PLANNED" },
  { table: "MovieList", column: "status", default: "PLANNED" },
  { table: "TvList", column: "status", default: "PLANNED" },
  { table: "GameList", column: "status", default: "PLANNED" },
  { table: "BookList", column: "status", default: "PLANNED" },
  { table: "MusicList", column: "status", default: "PLANNED" },
  { table: "TvSeasonProgress", column: "status", default: "PLANNED" },
];

async function remapStatusDistribution() {
  for (const table of STATS_TABLES) {
    const has = await client.query(
      `SELECT 1 FROM information_schema.columns
       WHERE table_schema='public' AND table_name=$1 AND column_name='statusDistribution'`,
      [table],
    );
    if (has.rowCount === 0) continue;
    const rows = await client.query(
      `SELECT id, "statusDistribution" AS d FROM ${q(table)} WHERE "statusDistribution" IS NOT NULL AND "statusDistribution" <> '{}'::jsonb`,
    );
    let changed = 0;
    for (const row of rows.rows) {
      const next: Record<string, number> = {};
      let diff = false;
      for (const [k, v] of Object.entries(row.d as Record<string, number>)) {
        const nk = LIST_MAP[k] ?? k;
        if (nk !== k) diff = true;
        next[nk] = (next[nk] ?? 0) + Number(v);
      }
      if (diff) {
        await client.query(
          `UPDATE ${q(table)} SET "statusDistribution" = $1::jsonb WHERE id = $2`,
          [JSON.stringify(next), row.id],
        );
        changed++;
      }
    }
    if (changed) console.log(`  ✓ ${table}.statusDistribution: ${changed} rows remapped`);
  }
}

async function main() {
  await client.connect();
  console.log(`Connected. ${DRY_RUN ? "[DRY RUN – will roll back]" : ""}`);
  await client.query("BEGIN");

  try {
    // Row counts to verify nothing is lost
    const countTables = [
      ...new Set([
        ...MEDIA_TABLE_DEFS.map((c) => c.table),
        ...LIST_TABLE_DEFS.map((c) => c.table),
        "OtherList",
      ]),
    ];
    const pre: Record<string, string> = {};
    for (const t of countTables) {
      const r = await client.query(`SELECT count(*) AS c FROM ${q(t)}`);
      pre[t] = r.rows[0].c;
    }

    console.log("\nMedia status columns:");
    for (const def of MEDIA_TABLE_DEFS) {
      await convertColumn(def.table, def.column, MEDIA_MAP, def.default, "UNKNOWN");
    }

    console.log("\nList status columns:");
    for (const def of LIST_TABLE_DEFS) {
      await convertColumn(def.table, def.column, LIST_MAP, def.default, "PLANNED");
    }

    // OtherList.status conversion
    const otherCol = await client.query(
      `SELECT data_type, udt_name FROM information_schema.columns
       WHERE table_schema='public' AND table_name='OtherList' AND column_name='status'`,
    );
    if (otherCol.rows.length > 0) {
      console.log("\nOther list status:");
      const hasStatuses = await client.query(
        `SELECT 1 FROM information_schema.columns
         WHERE table_schema='public' AND table_name='Other' AND column_name='statuses'`,
      );
      if (hasStatuses.rowCount) {
        await client.query(`
          UPDATE "OtherList" ol SET status = 'COMPLETED'
          FROM "Other" o, jsonb_array_elements(o.statuses) s
          WHERE ol."otherId" = o.id
            AND s->>'key' = ol.status
            AND COALESCE((s->>'isCompleted')::boolean, false) = true`);
        await client.query(`ALTER TABLE "Other" DROP COLUMN statuses`);
        console.log("  - dropped Other.statuses");
      }
      await convertColumn("OtherList", "status", LIST_MAP, "PLANNED", "IN_PROGRESS");
    }

    console.log("\nJSON status distributions:");
    await remapStatusDistribution();

    for (const t of Object.keys(pre)) {
      const r = await client.query(`SELECT count(*) AS c FROM ${q(t)}`);
      if (r.rows[0].c !== pre[t]) {
        throw new Error(`Row count mismatch on ${t}: ${pre[t]} → ${r.rows[0].c}`);
      }
    }

    if (DRY_RUN) {
      await client.query("ROLLBACK");
      console.log("\n✔ Dry run OK – rolled back, no changes made.");
    } else {
      await client.query("COMMIT");
      console.log("\n✔ Done. Row counts verified. Next: bun run db:update && bun run db:verify");
    }
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("\n✘ Failed – rolled back, database unchanged:", err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
