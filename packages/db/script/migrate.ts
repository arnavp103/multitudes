import { pool } from "../src/client";
import { migrateDatabase } from "../src/migrate";

try {
  await migrateDatabase(pool);
} finally {
  await pool.end();
}
