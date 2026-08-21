import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// service_role client — bypasses RLS entirely. Only ever used inside Edge
// Functions, never shipped to the browser/app.
export function supabaseAdmin() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  );
}
