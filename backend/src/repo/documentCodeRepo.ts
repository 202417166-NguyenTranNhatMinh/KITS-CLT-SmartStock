import { pool } from "../config/db";
import type { Queryable } from "../types/db";

export type DocumentPrefix = "PN" | "PX";

/**
 * Uses the document_counters table from migration 007. PostgreSQL's UPSERT is
 * atomic, so concurrent requests receive distinct sequence numbers.
 */
export interface DocumentCodeRepository {
  reserveNextSequence(prefix: DocumentPrefix, date: string): Promise<number>;
}

export async function reserveNextSequence(
  prefix: DocumentPrefix,
  date: string,
  db: Queryable = pool,
): Promise<number> {
  const { rows } = await db.query<{ last_no: number }>(
    `INSERT INTO document_counters (prefix, day, last_no)
     VALUES ($1, TO_DATE($2, 'YYYYMMDD'), 1)
     ON CONFLICT (prefix, day)
     DO UPDATE SET last_no = document_counters.last_no + 1
     RETURNING last_no`,
    [prefix, date],
  );
  return rows[0].last_no;
}

export const documentCodeRepository: DocumentCodeRepository = { reserveNextSequence };
