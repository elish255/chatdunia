import { useEffect, useState, type FormEvent, type InputHTMLAttributes, type ReactNode } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Eye, EyeOff, LockKeyhole, Mail, Send, UserRound, Linkedin, Instagram, Facebook } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuthSession } from "./AuthSession";

type Mode = "register" | "login" | "forgot" | "reset";
const countries = ["Tanzania", "Kenya", "Uganda", "Rwanda", "Burundi", "Congo", "Zambia", "Malawi"];

function Field({ label, icon, trailing, ...props }: InputHTMLAttributes<HTMLInputElement> & { label: string; icon?: ReactNode; trailing?: ReactNode }) {
  return <label className="auth-field"><span>{label}</span><div className="auth-input"><span className="auth-input-icon">{icon}</span><input aria-label={label} {...props} />{trailing}</div></label>;
}

export function AuthPage({ mode }: { mode: Mode }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [visible, setVisible] = useState(false);
  const [privacy, setPrivacy] = useState(false);
  const [recovery, setRecovery] = useState(false);
  const { user, ready } = useAuthSession();
  const navigate = useNavigate();
  useEffect(() => {
    if (mode === "reset") setRecovery(new URLSearchParams(window.location.hash.slice(1)).get("type") === "recovery");
  }, [mode]);
  useEffect(() => {
    if (ready && user && (mode === "login" || mode === "register")) void navigate({ to: "/", replace: true });
  }, [ready, user, mode, navigate]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(""); setMessage("");
    const data = new FormData(event.currentTarget);
    const value = (name: string) => String(data.get(name) || "").trim();
    const password = String(data.get("password") || "");
    if ((mode === "register" || mode === "reset") && password !== String(data.get("confirm") || "")) { setError("Passwords do not match."); return; }
    setBusy(true);
    try {
      if (mode === "register") {
        const { error: authError } = await supabase.auth.signUp({ email: value("email"), password, options: { emailRedirectTo: window.location.origin, data: { full_name: value("full_name"), username: value("username").toLowerCase(), phone: value("phone"), country: value("country") } } });
        if (authError) throw authError;
        setMessage("Check your email to confirm your account before signing in.");
      } else if (mode === "login") {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: value("email"), password });
        if (authError) throw authError;
        await navigate({ to: "/", replace: true });
      } else if (mode === "forgot") {
        const { error: authError } = await supabase.auth.resetPasswordForEmail(value("email"), { redirectTo: window.location.origin + "/reset-password" });
        if (authError) throw authError;
        setMessage("If an account exists for this email, a password reset link has been sent.");
      } else {
        if (!recovery || !user) throw new Error("Open the password reset link from your email first.");
        const { error: authError } = await supabase.auth.updateUser({ password });
        if (authError) throw authError;
        setMessage("Your password has been updated.");
      }
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Unable to continue. Please try again."); }
    finally { setBusy(false); }
  }

  async function google() {
    setBusy(true); setError("");
    try {
      const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (result.error) throw result.error;
      if (!result.redirected) await navigate({ to: "/", replace: true });
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Google sign-in failed."); }
    finally { setBusy(false); }
  }
  const register = mode === "register";
  const title = register ? "Create Your Account" : mode === "login" ? "Login" : mode === "forgot" ? "Forgot password?" : "Reset password";
  return <main className={`auth-page ${register ? "auth-register" : "auth-login"}`}>
    <section className="auth-content">
      <h1>{title}</h1>
      <p className="auth-subtitle">{register ? "Enter your personal details to create account" : mode === "login" ? "Welcome back! Log in to your account." : mode === "forgot" ? "Enter your email to reset your password." : "Choose your new password."}</p>
      <form onSubmit={submit}>
        {register && <>
          <Field label="Full Name" name="full_name" placeholder="Full Name" autoComplete="name" required icon={<Mail />} />
          <Field label="Username" name="username" placeholder="Username" autoComplete="username" required pattern="[a-zA-Z0-9_]{3,30}" title="3–30 letters, numbers or underscores" icon={<Mail />} />
          <Field label="Phone" name="phone" placeholder="255xxxxxxxxx" type="tel" autoComplete="tel" required pattern="[+]?[0-9]{9,15}" icon={null} />
        </>}
        {mode !== "reset" && <Field label="Email Address" name="email" placeholder={register ? "user@gmail.com" : "email"} type="email" autoComplete="email" required icon={<Mail />} />}
        {register && <label className="auth-field"><span>Country</span><div className="auth-input"><span className="auth-input-icon"><Send /></span><select name="country" aria-label="Country" required defaultValue=""><option value="" disabled>Choose Country...</option>{countries.map(country => <option key={country}>{country}</option>)}</select></div></label>}
        {mode !== "forgot" && <div className={register ? "auth-password-pair" : "auth-password-stack"}>
          <Field label="Password" name="password" placeholder={register ? "Password" : "*********"} autoComplete={mode === "login" ? "current-password" : "new-password"} type={visible ? "text" : "password"} minLength={8} required icon={register ? <UserRound /> : <LockKeyhole />} trailing={!register && <Button type="button" variant="reference" className="auth-eye" aria-label={visible ? "Hide password" : "Show password"} onClick={() => setVisible(!visible)}>{visible ? <EyeOff /> : <Eye />}</Button>} />
          {(register || mode === "reset") && <Field label="Confirm Password" name="confirm" placeholder="Confirm Password" autoComplete="new-password" type="password" minLength={8} required icon={<UserRound />} />}
        </div>}
        {register && <label className="auth-agreement"><input type="checkbox" required name="agree" /><span>Agree With <Button type="button" variant="reference" className="auth-policy-link" onClick={() => setPrivacy(true)}>Privacy Policy</Button></span></label>}
        {mode === "login" && <div className="auth-login-options"><label><input type="checkbox" name="remember" defaultChecked /> Remember password</label><Button asChild variant="reference"><Link to="/forgot-password">Forgot password?</Link></Button></div>}
        {error && <p className="auth-error" role="alert">{error}</p>}
        {message && <p className="auth-message" role="status">{message}</p>}
        <Button variant="reference" type="submit" disabled={busy || (mode === "reset" && !recovery)} className="auth-submit">{busy ? "Please wait..." : register ? "CREATE ACCOUNT" : mode === "login" ? "SIGN IN" : mode === "forgot" ? "SEND RESET LINK" : "SAVE PASSWORD"}</Button>
      </form>
      {mode === "login" && <><div className="auth-divider"><span>or continue with</span></div><div className="auth-socials"><Button variant="reference" className="auth-social" aria-label="Sign in with Google" title="Sign in with Google" disabled={busy} onClick={google}><strong>G</strong></Button>{[{ name: "LinkedIn", icon: <Linkedin /> }, { name: "X", icon: <span>𝕏</span> }, { name: "Facebook", icon: <Facebook /> }, { name: "Instagram", icon: <Instagram /> }].map(social => <Button key={social.name} variant="reference" className="auth-social" title={`${social.name} sign-in is unavailable`} aria-label={`${social.name} sign-in unavailable`} onClick={() => setError(`${social.name} sign-in is not supported. Use email or Google.`)}>{social.icon}</Button>)}</div></>}
      <p className="auth-footer">{register ? <>Already have an account? <Button asChild variant="reference"><Link to="/login">Sign in</Link></Button></> : mode === "login" ? <>Don't have an account? <Button asChild variant="reference"><Link to="/register">Create Account</Link></Button></> : <Button asChild variant="reference"><Link to="/login">Back to sign in</Link></Button>}</p>
    </section>
    {privacy && <div className="auth-policy-overlay"><section role="dialog" aria-modal="true" aria-labelledby="privacy-title" className="auth-policy"><h2 id="privacy-title">Privacy Policy</h2><p>Creating an account stores your name, username, phone number, country and email for your Chatdunia account. Your password is managed securely by the account service.</p><p>Chat replies, balances and withdrawal notices on Chatdunia are simulations, not real payments. Registration does not activate a payment service.</p><Button variant="reference" className="auth-submit" onClick={() => setPrivacy(false)}>CLOSE</Button></section></div>}
  </main>;
}