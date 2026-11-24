import type { Pool, PoolClient } from 'pg';

/**
 * Hàm repo nhận `db` là Pool (query thường) hoặc PoolClient (đang trong transaction).
 * Nhờ vậy Minh gọi được cùng hàm repo bên trong withTransaction.
 */
export type Queryable = Pool | PoolClient;
