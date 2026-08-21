// Grouped admin operations, all gated behind the custom staff JWT from
// staff-login (verified manually here — no RLS/auth.uid() involved, since
// staff identity is entirely separate from Supabase Auth). staff_users,
// global_passwords, global_pass_usage and maintenance are RLS-closed to
// everyone else, so this is the only path that can touch them, alongside
// admin-level reads/writes on profiles.
//
// Routed by `{ action, payload }` in the request body — mirrors the
// controllers/user.ts (admin parts), controllers/staffuser.ts,
// controllers/maintenance.ts and controllers/globalpass.ts surface from the
// old Express app.
import { verify } from "https://deno.land/x/djwt@v3.0.2/mod.ts";
import bcrypt from "https://esm.sh/bcryptjs@2.4.3";
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

async function requireStaff(req: Request) {
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    throw new Response(JSON.stringify({ error: "Missing staff token." }), { status: 401 });
  }
  const token = authHeader.slice(7);
  const key = await getSigningKey();
  const payload = await verify(token, key) as { sub: string; username: string; role: string };
  return payload;
}

function pageOptions(page?: string, limit?: string) {
  const p = parseInt(page ?? "0") || 0;
  const l = parseInt(limit ?? "10") || 10;
  return { page: p, limit: l, skip: p * l };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  let staff: { sub: string; username: string; role: string };
  try {
    staff = await requireStaff(req);
  } catch (res) {
    if (res instanceof Response) return res;
    return jsonResponse({ error: "Invalid or expired staff token." }, 401);
  }

  const admin = supabaseAdmin();

  try {
    const { action, payload } = await req.json();

    switch (action) {
      // ── player (end-user) admin ops ─────────────────────────────
      case "user.list": {
        const { page, limit, search } = payload ?? {};
        const opts = pageOptions(page, limit);
        let query = admin.from("profiles").select("id, username, status, created_at", { count: "exact" });
        if (search) query = query.ilike("username", `%${search}%`);
        const { data, count, error } = await query
          .order("created_at", { ascending: false })
          .range(opts.skip, opts.skip + opts.limit - 1);
        if (error) throw error;
        return jsonResponse({
          userlist: data,
          totalPages: Math.ceil((count ?? 0) / opts.limit),
        });
      }

      case "user.getDetails": {
        const { userId } = payload;
        const { data, error } = await admin
          .from("profiles")
          .select("username, status, user_details(*)")
          .eq("id", userId)
          .maybeSingle();
        if (error) throw error;
        if (!data) return jsonResponse({ error: "User not found." }, 404);
        return jsonResponse(data);
      }

      case "user.ban": {
        const { userId, status } = payload;
        const { error } = await admin.from("profiles").update({ status }).eq("id", userId);
        if (error) throw error;
        return jsonResponse({ message: "User status updated successfully" });
      }

      case "user.banMultiple": {
        const { userIds, status } = payload as { userIds: string[]; status: string };
        if (!userIds?.length) return jsonResponse({ error: "No users to update." }, 400);
        const { error } = await admin.from("profiles").update({ status }).in("id", userIds);
        if (error) throw error;
        return jsonResponse({ message: "Users status updated successfully" });
      }

      case "user.changePassword": {
        const { userId, password } = payload;
        const { error } = await admin.auth.admin.updateUserById(userId, { password });
        if (error) throw error;
        return jsonResponse({ message: "Password changed successfully" });
      }

      // ── staff (admin) management ────────────────────────────────
      case "staff.list": {
        const { page, limit, search } = payload ?? {};
        const opts = pageOptions(page, limit);
        let query = admin.from("staff_users").select("id, username, status, created_at", { count: "exact" })
          .neq("role", "superadmin");
        if (search) query = query.ilike("username", `%${search}%`);
        const { data, count, error } = await query
          .order("created_at", { ascending: false })
          .range(opts.skip, opts.skip + opts.limit - 1);
        if (error) throw error;
        return jsonResponse({ users: data, totalPages: Math.ceil((count ?? 0) / opts.limit) });
      }

      case "staff.ban": {
        const { username, status } = payload;
        const { error } = await admin.from("staff_users").update({ status }).eq("username", username);
        if (error) throw error;
        return jsonResponse({ message: "User status updated successfully" });
      }

      case "staff.banMultiple": {
        const { usernames, status } = payload as { usernames: string[]; status: string };
        if (!usernames?.length) return jsonResponse({ error: "No users to update." }, 400);
        const { error } = await admin.from("staff_users").update({ status }).in("username", usernames);
        if (error) throw error;
        return jsonResponse({ message: "Users status updated successfully" });
      }

      case "staff.changePassword": {
        const { username, password } = payload;
        const hash = await bcrypt.hash(password, 10);
        const { error } = await admin.from("staff_users").update({ password_hash: hash }).eq("username", username);
        if (error) throw error;
        return jsonResponse({ message: "Password changed successfully" });
      }

      case "staff.register": {
        if (staff.role !== "superadmin") {
          return jsonResponse({ error: "Insufficient permission." }, 403);
        }
        const { username, password } = payload;
        const { data: existing } = await admin.from("staff_users").select("id").ilike("username", username).maybeSingle();
        if (existing) return jsonResponse({ error: "You already registered this account!" }, 400);
        const hash = await bcrypt.hash(password, 10);
        const { error } = await admin.from("staff_users").insert({
          username, password_hash: hash, status: "active", role: "admin",
        });
        if (error) throw error;
        return jsonResponse({ message: "Staff registration successful" });
      }

      // ── maintenance ──────────────────────────────────────────────
      case "maintenance.get": {
        const { data, error } = await admin.from("maintenance").select("*");
        if (error) throw error;
        return jsonResponse({ data });
      }

      case "maintenance.set": {
        const { type, value } = payload;
        const { error } = await admin.from("maintenance").update({ value }).eq("type", type);
        if (error) throw error;
        return jsonResponse({ message: "Maintenance updated successfully" });
      }

      case "maintenance.getEvent": {
        const { type } = payload;
        const { data, error } = await admin.from("maintenance").select("type, value").eq("type", type).maybeSingle();
        if (error) throw error;
        if (!data) return jsonResponse({ error: "Maintenance type not found." }, 400);
        return jsonResponse(data);
      }

      // ── globalpass ───────────────────────────────────────────────
      case "globalpass.create": {
        const { secretkey } = payload;
        const hash = await bcrypt.hash(secretkey, 10);
        await admin.from("global_passwords").update({ status: false }).eq("status", true);
        const { data, error } = await admin.from("global_passwords").insert({
          owner_id: staff.sub, passcode_hash: hash, status: true,
        }).select().single();
        if (error) throw error;
        return jsonResponse({ message: "success", data });
      }

      case "globalpass.usageHistory": {
        const { page, limit } = payload ?? {};
        const opts = pageOptions(page, limit);
        const { data, count, error } = await admin
          .from("global_pass_usage")
          .select("*", { count: "exact" })
          .order("created_at", { ascending: false })
          .range(opts.skip, opts.skip + opts.limit - 1);
        if (error) throw error;
        return jsonResponse({
          usageHistory: data,
          totalPages: Math.ceil((count ?? 0) / opts.limit),
        });
      }

      default:
        return jsonResponse({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("staff-admin error:", err);
    return jsonResponse({ error: "Admin operation failed." }, 500);
  }
});
