import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const databaseUrl = process.env.SUPABASE_DATABASE_URL;
if (!databaseUrl) {
  process.stderr.write("SUPABASE_DATABASE_URL is required to apply migrations.\n");
  process.exit(1);
}

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const migrationPath = path.resolve(
  scriptDir,
  "../../../supabase/migrations/001_hospital_resource_management.sql",
);
const migration = await readFile(migrationPath, "utf8");
const pool = new pg.Pool({ connectionString: databaseUrl, max: 1 });

try {
  await pool.query(migration);
  process.stdout.write("Supabase schema and row-level security are up to date.\n");
} catch {
  process.stderr.write(
    "Migration failed. Verify the Supabase connection and that the account can create tables and RLS policies.\n",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
