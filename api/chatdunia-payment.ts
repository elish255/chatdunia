import { createClient } from "@supabase/supabase-js";

const API_BASE = "https://api.splashpay.co.tz/api/v1";
const send = (res: any, status: number, body: Record<string, unknown>) => res.status(status).json(body);

function splashHeaders(idempotencyKey?: string) {
  const key = process.env.SPLASHPAY_API_KEY;
  const secret = process.env.SPLASHPAY_API_SECRET;
  if (!key || !secret) throw new Error("SPLASHPAY_API_KEY and SPLASHPAY_API_SECRET must be configured.");
  return {
    "Content-Type": "application/json",
    Accept: "application/json",
    "X-API-KEY": key,
    "X-API-SECRET": secret,
    ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
  };
}
function nestedData(body: any) {
  return body?.data && typeof body.data === "object" ? body.data : body;
}
function makeReference() {
  return `INV-${Date.now()}-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
}

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") return send(res, 405, { message: "Method not allowed." });
  try {
    const supabaseUrl = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const anonKey = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !anonKey || !serviceKey) {
      console.error("Missing Supabase server configuration", { supabaseUrl: !!supabaseUrl, anonKey: !!anonKey, serviceKey: !!serviceKey });
      return send(res, 500, { message: "Huduma haijawekwa sawa kwenye Vercel Environment Variables." });
    }
    const authorization = req.headers.authorization || "";
    const token = authorization.startsWith("Bearer ") ? authorization.slice(7) : "";
    if (!token) return send(res, 401, { message: "Tafadhali ingia kwenye akaunti yako." });
    const userClient = createClient(supabaseUrl, anonKey, { auth: { persistSession: false, autoRefreshToken: false }, global: { headers: { Authorization: `Bearer ${token}` } } });
    const { data: userResult, error: authError } = await userClient.auth.getUser(token);
    if (authError || !userResult.user) return send(res, 401, { message: "Session imeisha. Ingia tena kisha ujaribu." });
    const user = userResult.user;
    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const body = typeof req.body === "string" ? JSON.parse(req.body) : (req.body || {});

    if (body.action === "create") {
      const phone = String(body.phone || "").replace(/\D/g, "");
      if (!/^255[0-9]{9}$/.test(phone)) return send(res, 400, { message: "Weka namba sahihi ya simu ya Tanzania." });
      const amount = Number(body.amount);
      const purpose = String(body.purpose || "activation");
      if (![16000, 32000].includes(amount) || (purpose === "premium" && amount !== 32000) || (purpose !== "premium" && amount !== 16000)) {
        return send(res, 400, { message: "Kiasi cha malipo si sahihi." });
      }
      const { data: profile, error: profileError } = await admin.from("chatdunia_users").select("full_name,username,email,activation_paid,account_status,is_premium").eq("id", user.id).maybeSingle();
      if (profileError || !profile) return send(res, 404, { message: "Taarifa za akaunti hazijapatikana." });
      if (purpose === "activation" && profile.activation_paid && profile.account_status === "active") return send(res, 409, { message: "Akaunti yako tayari imewashwa." });
      if (purpose === "premium" && profile.is_premium) return send(res, 409, { message: "Akaunti yako tayari ni Premium." });

      const reference = makeReference();
      const providerResponse = await fetch(`${API_BASE}/payments/mobile-money`, {
        method: "POST",
        headers: splashHeaders(reference),
        body: JSON.stringify({
          amount, currency: "TZS", reference, phone,
          customer_name: String(profile.full_name || profile.username || "Chatdunia User"),
          customer_email: String(user.email || `${user.id}@chatdunia.online`),
          metadata: { user_id: user.id, purpose, product: purpose === "premium" ? "Chatdunia Premium" : "Chatdunia activation" },
        }),
      });
      const providerBody: any = await providerResponse.json().catch(() => ({}));
      const order = nestedData(providerBody);
      if (!providerResponse.ok || String(providerBody?.status || "").toLowerCase() !== "success" || !order?.reference) {
        console.error("SplashPay create payment failed", providerResponse.status, providerBody);
        return send(res, 502, { message: providerBody?.message || "Imeshindikana kuanzisha." });
      }
      const orderId = String(order.reference);
      const { error: insertError } = await admin.from("chatdunia_payments").insert({
        user_id: user.id, order_id: orderId, amount, currency: "TZS", phone,
        status: String(order.status || "pending").toLowerCase(), provider_reference: order.provider_reference || null,
      });
      if (insertError) {
        console.error("Could not save SplashPay payment", insertError);
        return send(res, 500, { message: "Ombi limeanzishwa lakini kumbukumbu haijahifadhiwa. Tafadhali wasiliana na huduma kwa wateja kabla ya kujaribu tena." });
      }
      return send(res, 200, { order_id: orderId, payment_status: String(order.status || "pending").toUpperCase(), message: providerBody?.message || "Ombi limetumwa. Thibitisha kwenye simu yako; tunakagua hali ya malipo moja kwa moja." });
    }

    if (body.action === "status") {
      const orderId = String(body.order_id || "").trim();
      if (!/^INV-[A-Za-z0-9-]{5,180}$/.test(orderId)) return send(res, 400, { message: "Reference ya malipo si sahihi." });
      const { data: payment, error: paymentError } = await admin.from("chatdunia_payments").select("id,user_id,amount,status").eq("order_id", orderId).eq("user_id", user.id).maybeSingle();
      if (paymentError || !payment) return send(res, 404, { message: "Oda ya malipo haijapatikana." });

      // Documented SplashPay Payment Status API. Polling only; no webhook is used.
      const providerResponse = await fetch(`${API_BASE}/payments/check-status`, {
        method: "POST",
        headers: splashHeaders(),
        body: JSON.stringify({ reference: orderId }),
      });
      const providerBody: any = await providerResponse.json().catch(() => ({}));
      const result = nestedData(providerBody);
      if (!providerResponse.ok || String(providerBody?.status || "").toLowerCase() !== "success" || !result) {
        console.error("SplashPay status request failed", providerResponse.status, providerBody);
        return send(res, providerResponse.status === 404 ? 404 : 502, { message: providerBody?.message || "Imeshindikana kuthibitisha hali ya malipo kwa sasa." });
      }
      const status = String(result?.status || result?.payment_status || "pending").toUpperCase();
      const isSuccess = status === "SUCCESS";
      const isFailed = ["FAILED", "CANCELLED", "EXPIRED"].includes(status);
      const { error: updatePaymentError } = await admin.from("chatdunia_payments").update({
        status: isSuccess ? "success" : isFailed ? status.toLowerCase() : status.toLowerCase(),
        provider_reference: result?.provider_reference || null,
        completed_at: isSuccess ? new Date().toISOString() : null,
      }).eq("id", payment.id);
      if (updatePaymentError) console.error("SplashPay status save failed", updatePaymentError);

      if (isSuccess) {
        const isPremiumPayment = Number(payment.amount) === 32000;
        const changes = isPremiumPayment ? { is_premium: true, updated_at: new Date().toISOString() } : { activation_paid: true, account_status: "active", updated_at: new Date().toISOString() };
        const { error: activationError } = await admin.from("chatdunia_users").update(changes).eq("id", user.id);
        if (activationError) {
          console.error("Chatdunia account activation failed after confirmed payment", activationError);
          return send(res, 500, { message: "Malipo yamethibitishwa lakini akaunti haikuweza kusasishwa. Wasiliana na huduma kwa wateja." });
        }
      }
      return send(res, 200, { payment_status: status });
    }
    return send(res, 400, { message: "Ombi halijatambulika." });
  } catch (error) {
    console.error("Chatdunia SplashPay API error", error);
    return send(res, 500, { message: error instanceof Error && error.message.includes("SPLASHPAY_") ? "Weka SPLASHPAY_API_KEY na SPLASHPAY_API_SECRET kwenye Vercel Environment Variables." : "Kuna hitilafu ya muda kwenye malipo. Tafadhali jaribu tena." });
  }
}
