import 'server-only';
import { types, Pool, type PoolClient } from 'pg';

// Keep DATE columns as YYYY-MM-DD strings. node-pg otherwise builds a JS Date
// in the server timezone and can shift the calendar day.
types.setTypeParser(1082, (value) => value);

export class DatabaseConfigError extends Error {
  constructor() {
    super('DATABASE_URL is not set');
    this.name = 'DatabaseConfigError';
  }
}

const globalForPg = globalThis as unknown as { itineraryPool?: Pool };

export function getPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new DatabaseConfigError();
  if (!globalForPg.itineraryPool) {
    globalForPg.itineraryPool = new Pool({
      connectionString,
      max: 5,
    });
  }
  return globalForPg.itineraryPool;
}

export async function withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await fn(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
