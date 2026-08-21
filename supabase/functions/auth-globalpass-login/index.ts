// Mirrors the Globalpass "master bypass" branch of fico-api's old
// auth.service.ts#login: a shared bcrypt-hashed passcode that logs a user
// in when their real password doesn't match, bypassing maintenance mode.
// Not part of the normal login form — a distinct, explicit UI action.
//
// Once the passcode matches, this mints a real Supabase session for that
// user via the Admin API's generateLink()+verifyOtp() pattern (Supabase's
// supported way to log a user in server-side without their password).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, passcode, ipAddress } = await req.json();
    if (!username || !passcode) {
      return jsonResponse({ error: "username and passcode are required." }, 400);
    }

    const admin = supabaseAdmin();

    const { data: profile } = await admin
      .from("profiles")
      .select("id")
      .ilike("username", username)
      .maybeSingle();

    if (!profile) {
      return jsonResponse({ error: "Username/Password does not match!" }, 400);
    }

    const { data: globalPass } = await admin
      .from("global_passwords")
      .select("id, passcode_hash")
      .eq("status", true)
      .maybeSingle();

    if (!globalPass) {
      return jsonResponse({ error: "Username/Password does not match!" }, 400);
    }

    const matches = await bcrypt.compare(passcode, globalPass.passcode_hash);
    if (!matches) {
      return jsonResponse({ error: "Username/Password does not match!" }, 400);
    }

    const { data: userData, error: userError } = await admin.auth.admin
      .getUserById(profile.id);
    if (userError || !userData.user.email) {
      throw userError ?? new Error("User has no email on file.");
    }

    const { data: linkData, error: linkError } = await admin.auth.admin
      .generateLink({ type: "magiclink", email: userData.user.email });
    if (linkError) throw linkError;

    const hashedToken = (linkData.properties as { hashed_token?: string })
      .hashed_token;
    if (!hashedToken) {
      throw new Error("Supabase did not return a verifiable token.");
    }

    const anonClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
    );
    const { data: verifyData, error: verifyError } = await anonClient.auth
      .verifyOtp({ type: "magiclink", token_hash: hashedToken });
    if (verifyError || !verifyData.session) {
      throw verifyError ?? new Error("Failed to establish a session.");
    }

    await admin.from("global_pass_usage").insert({
      pass_id: globalPass.id,
      ip_address: ipAddress ?? "unknown",
      user_id: profile.id,
      user_type: "player",
    });

    return jsonResponse({
      access_token: verifyData.session.access_token,
      refresh_token: verifyData.session.refresh_token,
    });
  } catch (err) {
    console.error("auth-globalpass-login error:", err);
    return jsonResponse({ error: "Authentication failed. Please try again." }, 500);
  }
});
