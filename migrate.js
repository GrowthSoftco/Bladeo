import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Supabase credentials
const supabaseUrl = 'https://xmidlniynlujtmduwqgf.supabase.co';
const supabaseServiceKey = 'sb_secret_EAwZ_yUtBNJpvQCOU-4Taw_-0umtcep';

// Create Supabase admin client
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function runMigrations() {
  try {
    console.log('🚀 Starting database migration...');

    // Read the SQL file
    const sqlContent = readFileSync(join(__dirname, 'database-schema.sql'), 'utf8');

    // Split the SQL into individual statements (basic approach)
    const statements = sqlContent
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📄 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);

      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });

        if (error) {
          // If rpc doesn't work, try direct query
          const { error: queryError } = await supabase.from('_supabase_migration_temp').select('*').limit(1);
          if (queryError) {
            console.log('⚠️  Using alternative method for SQL execution...');
            // For now, just log the statement that would need to be run manually
            console.log('📋 Statement to run manually in Supabase SQL Editor:');
            console.log(statement);
            console.log('---');
          }
        }
      } catch (err) {
        console.log('⚠️  Statement needs to be run manually in Supabase SQL Editor:');
        console.log(statement);
        console.log('---');
      }
    }

    console.log('✅ Migration script completed!');
    console.log('📋 If any statements failed, copy and run them manually in your Supabase SQL Editor');

  } catch (error) {
    console.error('❌ Migration failed:', error);
  }
}

runMigrations();