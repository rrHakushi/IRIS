# IRIS Database: Prisma 8 Production Migration Guide

This directory contains scripts to migrate a database from **Prisma 7** to **Prisma 8** safely with **zero data loss**.

---

## What These Scripts Do

1. **Enum Transition (`USING col::text`)**:
   PostgreSQL native enums created by Prisma 7 (`CREATE TYPE ... AS ENUM`) cannot be dropped while tables still use them. These scripts convert all 49 enum columns to `text USING col::text`, which preserves 100% of the row values and data without truncating or losing any strings. Existing column defaults are preserved as string literals.
2. **Empty Array Backfill**:
   Backfills legacy `NULL` values in array columns (e.g. `Anime.synonyms`) to empty array `'{}'` so that Prisma 8's non-null array constraints can apply cleanly.
3. **Transaction Safety & Row Verification**:
   The TypeScript script verifies table row counts before and after within a PostgreSQL transaction to ensure 0 rows are lost.

---

## How to Migrate Production

### Option 1: Run via Bun (Recommended)

From the repository root or `packages/database`:

```bash
# Set your production database URL
export DATABASE_URL="postgresql://user:password@prod-host:5432/dbname"

# 1. Prepare database (converts enums to text & backfills empty arrays)
bun run db:prepare-prisma8

# 2. Apply Prisma 8 contract (adds CHECK constraints, index renames, signs marker)
bun run db:update

# 3. Verify that database marker and schema match the contract
bun run db:verify
```

---

### Option 2: Run via Direct SQL (`psql` / Cloud Console)

If you prefer applying the migration via `psql` or a web SQL console (Supabase, Neon, AWS RDS, etc.):

1. **Execute Pre-migration SQL**:
   ```bash
   psql "$DATABASE_URL" -f packages/database/scripts/prepare-prisma8.sql
   ```
2. **Apply Prisma 8 Schema Update**:
   ```bash
   cd packages/database
   DATABASE_URL="$DATABASE_URL" bun run db:update
   ```
3. **Verify**:
   ```bash
   cd packages/database
   DATABASE_URL="$DATABASE_URL" bun run db:verify
   ```
