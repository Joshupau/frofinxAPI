// Resolves a `profiles.username` to the corresponding auth.users email, so
// the frontend can keep its username-based login form while feeding
// supabase.auth.signInWithPassword() the email it actually requires.
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username } = await req.json();
    if (!username || typeof username !== "string") {
      return jsonResponse({ error: "username is required." }, 400);
    }

    const admin = supabaseAdmin();

    const { data: profile, error: profileError } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (profileError) throw profileError;
    if (!profile) {
      return jsonResponse({ error: "Incorrect username or email." }, 404);
    }

    const { data: userData, error: userError } = await admin.auth.admin
      .getUserById(profile.id);
    if (userError) throw userError;

    return jsonResponse({ email: userData.user.email });
  } catch (err) {
    console.error("auth-resolve-username error:", err);
    return jsonResponse({ error: "Failed to resolve username." }, 500);
  }
});
