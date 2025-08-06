const fs = require('fs').promises;
const path = require('path');
const supabase = require('../src/config/database');

const MIGRATIONS_DIR = path.join(__dirname, '../src/db/migrations');

async function runMigrations() {
  try {
    console.log('Starting database migration...');

    const files = await fs.readdir(MIGRATIONS_DIR);
    const sqlFiles = files.filter(file => file.endsWith('.sql')).sort();

    if (sqlFiles.length === 0) {
      console.log('No migration files found.');
      return;
    }

    for (const file of sqlFiles) {
      console.log(`Applying migration: ${file}...`);
      const filePath = path.join(MIGRATIONS_DIR, file);
      const sql = await fs.readFile(filePath, 'utf-8');
      
      const { error } = await supabase.rpc('execute_sql', { sql });

      if (error) {
        console.error(`Error applying migration ${file}:`, error.message);
        // In a real-world scenario, you might want to handle transactions and rollbacks.
        process.exit(1);
      }
      console.log(`Successfully applied migration: ${file}`);
    }

    console.log('Database migration completed successfully.');
  } catch (err) {
    console.error('Failed to run migrations:', err.message);
    process.exit(1);
  }
}

// Helper function in Supabase to execute raw SQL
async function createSqlExecutionFunction() {
    const sql = `
    CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
    RETURNS void AS $$
    BEGIN
        EXECUTE sql;
    END;
    $$ LANGUAGE plpgsql;`

    const { error } = await supabase.rpc('execute_sql', { sql });
    if (error && error.code !== '42723') { // 42723 = duplicate_function
        console.error('Failed to create execute_sql function:', error);
        process.exit(1);
    }
    console.log('execute_sql function is ready.');
}

(async () => {
    await createSqlExecutionFunction();
    await runMigrations();
})();
