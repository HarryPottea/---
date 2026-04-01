import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabase = (supabaseUrl && supabaseServiceRoleKey) 
  ? createClient(supabaseUrl, supabaseServiceRoleKey) 
  : null;

if (!supabase) {
  console.warn("[SUPABASE] Supabase URL or Service Role Key is missing. Database operations will fail.");
}

// Connection test
(async () => {
  if (!supabase) return;
  try {
    const { error } = await supabase.from('test').select('*').limit(1);
    if (error && error.code !== 'PGRST116' && error.code !== '42P01') {
      console.error("[SUPABASE-SERVER] Connection test error:", error.message);
    } else {
      console.log("[SUPABASE-SERVER] Connection test successful (or table missing)");
    }
  } catch (e) {
    console.error("[SUPABASE-SERVER] Connection test failed:", e.message);
  }
})();
