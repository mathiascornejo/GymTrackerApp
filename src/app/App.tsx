import { useEffect, useState } from "react";
import { useSession } from "../data/auth";
import { configured } from "../data/client";
import { useProfile } from "../data/profile";
import { Library } from "./Library";
import { Routines } from "./Routines";
import { RankingSetup } from "./RankingSetup";
import { Settings } from "./Settings";
import { Shell } from "./Shell";
import { SignIn } from "./SignIn";
import { applyTheme } from "./theme";
import f from "./Form.module.css";
import s from "./Placeholder.module.css";

const SKIP_KEY = "tempered.setup-skipped";
const skipped = () => {
  try {
    return localStorage.getItem(SKIP_KEY) === "1";
  } catch {
    return false;
  }
};

function Authed() {
  const profile = useProfile();
  const [skip, setSkip] = useState(skipped);
  const p = profile.data;

  useEffect(() => {
    if (p) applyTheme(p.theme);
  }, [p?.theme]);

  if (profile.error)
    return (
      <div className={f.center}>
        <p className={f.error} role="alert">Could not load your profile: {profile.error.message}</p>
        <button className={f.button} onClick={() => void profile.refetch()}>Try again</button>
      </div>
    );
  if (!p) return null;

  if (p.standards_table === null && !skip)
    return (
      <div className={f.center}>
        <h1 className={f.title}>Set up ranks</h1>
        <RankingSetup
          profile={p}
          onSkip={() => {
            try {
              localStorage.setItem(SKIP_KEY, "1");
            } catch {
              /* skip lasts for this page load only */
            }
            setSkip(true);
          }}
        />
      </div>
    );

  // Tab content arrives in later phases; only the active route is mounted.
  return <Shell>{(route) =>
        route.id === "settings" ? <Settings profile={p} /> : route.id === "library" ? <Library /> : route.id === "routines" ? <Routines profile={p} /> : <p className={s.empty}>{route.hint}</p>
      }</Shell>;
}

export function App() {
  const session = useSession();
  if (!configured)
    return (
      <div className={f.center}>
        <h1 className={f.title}>Backend not configured</h1>
        <p className={f.lead}>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the dev server.</p>
      </div>
    );
  if (session === undefined) return null;
  return session ? <Authed /> : <SignIn />;
}
