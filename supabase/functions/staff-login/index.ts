// Staff/admin auth stays fully outside Supabase Auth (no equivalent for the
// separate admin identity system) — bcrypt-checks staff_users directly and
// mints this app's own short-lived HS256 JWT, verified manually by
// staff-admin. Never touches auth.users/profiles.
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
import { create, getNumericDate } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";
import { supabaseAdmin } from "../_shared/supabase-admin.ts";

async function getSigningKey(): Promise<CryptoKey> {
  const secret = Deno.env.get("STAFF_JWT_SECRET");
  if (!secret) throw new Error("STAFF_JWT_SECRET is not configured.");
  return await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { username, password } = await req.json();
    if (!username || !password) {
      return jsonResponse({ error: "username and password are required." }, 400);
    }

    const admin = supabaseAdmin();
    const { data: staff } = await admin
      .from("staff_users")
      .select("id, username, password_hash, status, role")
      .ilike("username", username)
      .maybeSingle();

    if (!staff) {
      return jsonResponse({ error: "Username/Password does not match!" }, 400);
    }

    const matches = await bcrypt.compare(password, staff.password_hash);
    if (!matches) {
      return jsonResponse({ error: "Username/Password does not match!" }, 400);
    }

    if (staff.status !== "active") {
      return jsonResponse({ error: `Your account had been ${staff.status}.` }, 401);
    }

    const key = await getSigningKey();
    const token = await create(
      { alg: "HS256", typ: "JWT" },
      {
        sub: staff.id,
        username: staff.username,
        role: staff.role,
        auth: staff.role,
        exp: getNumericDate(60 * 60 * 24), // 24h
      },
      key,
    );

    await admin.from("staff_users").update({ webtoken: token }).eq("id", staff.id);

    return jsonResponse({
      message: "success",
      data: { token, username: staff.username, auth: staff.role },
    });
  } catch (err) {
    console.error("staff-login error:", err);
    return jsonResponse({ error: "Authentication failed." }, 500);
  }
});
