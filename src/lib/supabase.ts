import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY!;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL and SUPABASE_SERVICE_KEY must be set');
}

/**
 * Module-level Supabase client singleton.
 * Reused across warm serverless invocations.
 * Uses service_role key — bypasses RLS, backend-only.
 */
export const supabase = createClient(supabaseUrl, supabaseKey);
