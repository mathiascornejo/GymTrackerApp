import { useState, type FormEvent } from "react";
import { auth, linkError } from "../data/auth";
import { EyeIcon } from "./icons";
import f from "./Form.module.css";

// The code flow exists because a magic link opens in Safari, not the installed iPhone app. It needs an email template
// containing {{ .Token }}, which Supabase only lets you edit with custom SMTP, so it is off unless the build opts in.
const EMAIL_CODE = import.meta.env.VITE_EMAIL_CODE_SIGNIN === "true";
type Mode = "password" | "create" | "code" | "forgot";

function PasswordField({ label, value, onChange, create }: { label: string; value: string; onChange: (v: string) => void; create?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className={f.passwordField}>
      <label>
        {label}
        <input
          className={f.input}
          type={show ? "text" : "password"}
          autoComplete={create ? "new-password" : "current-password"}
          minLength={create ? 8 : undefined}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
      <button type="button" className={f.reveal} aria-label={show ? "Hide password" : "Show password"} onClick={() => setShow(!show)}>
        <EyeIcon off={show} />
      </button>
    </div>
  );
}

/** Shown after a password-recovery link signs the user in. */
export function SetPassword({ onDone }: { onDone: () => void }) {
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const submit = (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage("");
    auth.updatePassword(password).then(onDone, (err: Error) => {
      setMessage(err.message);
      setBusy(false);
    });
  };
  return (
    <div className={f.center}>
      <h1 className={f.title}>Set a new password</h1>
      <p className={f.lead}>You're signed in from the reset link. Choose a new password for next time.</p>
      <form onSubmit={submit} className={f.group} style={{ width: "100%" }}>
        <div className={f.stack}>
          <PasswordField label="New password" value={password} onChange={setPassword} create />
          {message && <p className={f.error} role="alert">{message}</p>}
          <button className={f.button} type="submit" disabled={busy}>Save password</button>
        </div>
      </form>
      <div className={f.links}>
        <button className={f.quiet} onClick={onDone}>Skip for now</button>
      </div>
    </div>
  );
}

export function SignIn() {
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [codeSent, setCodeSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(linkError);
  const [notice, setNotice] = useState("");

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setMessage("");
    setNotice("");
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
      else if (mode === "forgot") {
        await auth.resetPassword(email);
        setNotice("If that email has an account, a link to set a new password is on its way.");
      }
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
    setNotice("");
    setCodeSent(false);
  };

  return (
    <div className={f.center}>
      <h1 className={f.title}>Tempered</h1>
      <p className={f.lead}>{mode === "create" ? "Create your account." : mode === "forgot" ? "We'll email you a link to set a new password." : "Sign in to your training log."}</p>
      <form onSubmit={submit} className={f.group} style={{ width: "100%" }}>
        <div className={f.stack}>
          <label>
            Email
            <input className={f.input} type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {(mode === "password" || mode === "create") && (
            <PasswordField label="Password" value={password} onChange={setPassword} create={mode === "create"} />
          )}
          {mode === "code" && codeSent && (
            <label>
              6-digit code from your email
              <input className={f.input} inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} required value={token} onChange={(e) => setToken(e.target.value)} />
            </label>
          )}
          {message && <p className={f.error} role="alert">{message}</p>}
          {notice && <p className={f.note} role="status">{notice}</p>}
          <button className={f.button} type="submit" disabled={busy}>
            {mode === "create" ? "Create account" : mode === "code" ? (codeSent ? "Verify code" : "Email me a code") : mode === "forgot" ? "Email me a link" : "Sign in"}
          </button>
        </div>
      </form>
      <div className={f.links}>
        {mode !== "password" && <button className={f.quiet} onClick={() => switchMode("password")}>Use password</button>}
        {mode === "password" && <button className={f.quiet} onClick={() => switchMode("forgot")}>Forgot password?</button>}
        {EMAIL_CODE && mode !== "code" && <button className={f.quiet} onClick={() => switchMode("code")}>Sign in with an email code</button>}
        {mode !== "create" && <button className={f.quiet} onClick={() => switchMode("create")}>Create account</button>}
      </div>
    </div>
  );
}
