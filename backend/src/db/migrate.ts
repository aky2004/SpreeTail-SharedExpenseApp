import fs from 'fs';
import path from 'path';
import { query } from './connection';

/**
 * Migration runner — executes schema.sql against the database.
 * Idempotent: uses IF NOT EXISTS and CREATE TYPE checks.
 */
async function migrate() {
  try {
    console.log('🔄 Running database migrations...');
    
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schema = fs.readFileSync(schemaPath, 'utf-8');
    
    await query(schema);
    
    console.log('✅ Database migrations completed successfully');
    process.exit(0);
  } catch (error: any) {
    // Handle "type already exists" errors gracefully
    if (error.code === '42710') {
      console.log('ℹ️  Some types already exist — this is fine on re-run');
      console.log('✅ Database migrations completed');
      process.exit(0);
    }
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrate();
