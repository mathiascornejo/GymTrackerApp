import { useState, type FormEvent } from "react";
import { auth } from "../data/auth";
import f from "./Form.module.css";

// The code flow exists because a magic link opens in Safari, not the installed iPhone app.
type Mode = "password" | "create" | "code";

export function SignIn() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    try {
      await fn();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Something went wrong. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e: FormEvent) => {
    e.preventDefault();
    void run(async () => {
      if (mode === "password") await auth.signIn(email, password);
      else if (mode === "create") {
        const started = await auth.signUp(email, password);
        if (!started) setMessage("Account created. Confirm your email, then sign in.");
      } else if (!codeSent) {
        await auth.sendCode(email);
        setCodeSent(true);
      } else await auth.verifyCode(email, token.trim());
    });
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setMessage("");
    setCodeSent(false);
  };

  return (
    <div className={f.center}>
      <h1 className={f.title}>Tempered</h1>
      <p className={f.lead}>{mode === "create" ? "Create your account." : "Sign in to your training log."}</p>
      <form onSubmit={submit} className={f.group} style={{ width: "100%" }}>
        <div className={f.stack}>
          <label>
            Email
            <input className={f.input} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== "code" && (
            <label>
              Password
              <input
                className={f.input}
                type="password"
                autoComplete={mode === "create" ? "new-password" : "current-password"}
                minLength={mode === "create" ? 8 : undefined}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
          )}
          {mode === "code" && codeSent && (
            <label>
              6-digit code from your email
              <input className={f.input} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
          )}
          {message && <p className={f.error} role="alert">{message}</p>}
          <button className={f.button} type="submit" disabled={busy}>
            {mode === "create" ? "Create account" : mode === "code" ? (codeSent ? "Verify code" : "Email me a code") : "Sign in"}
          </button>
        </div>
      </form>
      <div>
        {mode !== "password" && <button className={f.quiet} onClick={() => switchMode("password")}>Use password</button>}
        {mode !== "code" && <button className={f.quiet} onClick={() => switchMode("code")}>Sign in with an email code</button>}
        {mode !== "create" && <button className={f.quiet} onClick={() => switchMode("create")}>Create account</button>}
      </div>
    </div>
  );
}
