import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = (supabaseUrl && supabaseAnonKey) 
  ? createClient(supabaseUrl, supabaseAnonKey) 
  : null;

if (!supabase) {
  console.warn("[SUPABASE] Supabase URL or Anon Key is missing. Client-side database operations will fail.");
}

// Connection test
async function testConnection() {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('test').select('*').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') { // 42P01 is "relation does not exist"
      console.error("[SUPABASE] Connection test error:", error.message);
    } else {
      console.log("[SUPABASE] Connection test successful (or table missing, which is expected)");
    }
  } catch (error) {
    console.error("[SUPABASE] Connection test failed:", error);
  }
}

testConnection();
