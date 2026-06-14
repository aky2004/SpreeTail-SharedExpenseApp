import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

// Create a connection pool to PostgreSQL.
// Pool manages multiple connections and reuses them for performance.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // SSL required for production (Railway), disable for local dev
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
});

// Test connection on startup
pool.on('connect', () => {
  console.log('✅ Connected to PostgreSQL');
});

pool.on('error', (err) => {
  console.error('❌ PostgreSQL pool error:', err.message);
});

// Helper: run a query with parameterized values (prevents SQL injection)
export const query = (text: string, params?: any[]) => {
  return pool.query(text, params);
};

// Helper: get a single client for transactions
export const getClient = () => {
  return pool.connect();
};

export default pool;
