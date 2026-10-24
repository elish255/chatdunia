import { createClient } from "@supabase/supabase-js";

const send = (res: any, status: number, body: Record<string, unknown>) => res.status(status).json(body);

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return send(res, 405, { message: "Method not allowed." });
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceKey) return send(res, 500, { message: "Huduma haijawekwa sawa kwenye Vercel Environment Variables." });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});
    const username = String(body.username || "").trim().toLowerCase();
    const password = String(body.password || "");
    if (!/^[a-z0-9_]{3,30}$/.test(username) || !password) return send(res, 400, { message: "Weka username na password sahihi." });

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: profile, error: profileError } = await admin.from("chatdunia_users").select("id").eq("username", username).maybeSingle();
    if (profileError) {
      console.error("Chatdunia username lookup failed", profileError);
      return send(res, 500, { message: "Imeshindikana kutafuta username. Jaribu tena baadaye." });
    }
    if (!profile) return send(res, 401, { message: "Username au password si sahihi." });
    const { data: authUser, error: authUserError } = await admin.auth.admin.getUserById(String(profile.id));
    const email = authUser?.user?.email;
    if (authUserError || !email) return send(res, 401, { message: "Username au password si sahihi." });

    const auth = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: signedIn, error: signInError } = await auth.auth.signInWithPassword({ email, password });
    if (signInError || !signedIn.session) return send(res, 401, { message: "Username au password si sahihi. Kama umetumia email confirmation, hakikisha akaunti imethibitishwa." });
    return send(res, 200, { session: { access_token: signedIn.session.access_token, refresh_token: signedIn.session.refresh_token } });
  } catch (error) {
    console.error("Chatdunia username login error", error);
    return send(res, 500, { message: "Kuna hitilafu ya muda wakati wa kuingia. Jaribu tena." });
  }
}
