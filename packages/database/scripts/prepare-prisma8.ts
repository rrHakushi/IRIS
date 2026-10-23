import pg from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error("✘ Error: DATABASE_URL environment variable is not defined!");
  process.exit(1);
}

const client = new pg.Client({ connectionString });

async function main() {
  await client.connect();
  console.log("Connected to PostgreSQL database.");

  // 1. Identify native enum columns
  const enumColsRes = await client.query(`
    SELECT
      c.table_name,
      c.column_name,
      t.typname as enum_name,
      c.column_default
    FROM pg_type t
    JOIN pg_enum e ON t.oid = e.enumtypid
    JOIN information_schema.columns c ON c.udt_name = t.typname
    WHERE c.table_schema = 'public'
    GROUP BY t.typname, c.table_name, c.column_name, c.column_default
    ORDER BY c.table_name, c.column_name;
  `);

  console.log(`Found ${enumColsRes.rows.length} columns using native PostgreSQL enums.`);

  // Array columns that might hold NULL from Prisma 7
  const arrayColumns = [
    ["Anime", "synonyms"],
    ["Book", "subjects"],
    ["Book", "synonyms"],
    ["Character", "nameAlternative"],
    ["Character", "nameAlternativeSpoiler"],
    ["Game", "synonyms"],
    ["Manga", "synonyms"],
    ["Movie", "synonyms"],
    ["Person", "nameAlternative"],
    ["Tv", "broadcastDays"],
    ["Tv", "networks"],
    ["Tv", "synonyms"]
  ];

  // Record pre-conversion row counts for affected tables
  const tables = [...new Set([
    ...enumColsRes.rows.map(r => r.table_name),
    ...arrayColumns.map(([t]) => t)
  ])];

  const preCounts: Record<string, string> = {};
  for (const t of tables) {
    try {
      const res = await client.query(`SELECT count(*) as count FROM "${t}";`);
      preCounts[t] = res.rows[0].count;
    } catch {
      // Table might not exist yet if fresh DB
    }
  }

  console.log("Beginning migration transaction...");
  await client.query("BEGIN;");

  try {
    // A. Convert enum columns to text
    for (const row of enumColsRes.rows) {
      const table = `"${row.table_name}"`;
      const col = `"${row.column_name}"`;

      if (row.column_default !== null) {
        await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} DROP DEFAULT;`);
      }

      await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} TYPE text USING ${col}::text;`);

      if (row.column_default !== null) {
        const match = row.column_default.match(/^'([^']*)'/);
        if (match) {
          const val = match[1];
          await client.query(`ALTER TABLE ${table} ALTER COLUMN ${col} SET DEFAULT '${val}';`);
        }
      }
      console.log(`  ✓ Converted ${row.table_name}.${row.column_name} (${row.enum_name}) -> text`);
    }

    // B. Backfill NULL array columns to empty array '{}'
    for (const [table, col] of arrayColumns) {
      try {
        const res = await client.query(`UPDATE "${table}" SET "${col}" = '{}' WHERE "${col}" IS NULL;`);
        if (res.rowCount && res.rowCount > 0) {
          console.log(`  ✓ Backfilled ${table}.${col}: ${res.rowCount} NULL rows -> '{}'`);
        }
      } catch {
        // Table or column might not exist or already updated
      }
    }

    // C. Verify post-conversion row counts
    for (const t of Object.keys(preCounts)) {
      const res = await client.query(`SELECT count(*) as count FROM "${t}";`);
      const postCount = res.rows[0].count;
      if (postCount !== preCounts[t]) {
        throw new Error(`CRITICAL: Row count mismatch on table "${t}": was ${preCounts[t]}, now ${postCount}!`);
      }
    }

    await client.query("COMMIT;");
    console.log("\n✔ SUCCESS: Database prepared for Prisma 8 with ZERO data loss.");
    console.log("All row counts verified 100% identical.");
    console.log("\nNext step to finalize migration:");
    console.log("  bun run db:update");
    console.log("  bun run db:verify");
  } catch (err) {
    await client.query("ROLLBACK;");
    console.error("\n✘ ERROR during preparation! Transaction was rolled back. Zero changes made to the database:", err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
