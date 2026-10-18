import { lazy, Suspense, useEffect, useState } from "react";
import { useRecovery, useSession } from "../data/auth";
import { configured } from "../data/client";
import { useProfile } from "../data/profile";
import { ErrorBoundary } from "./ErrorBoundary";
import { RankingSetup } from "./RankingSetup";
import { Shell } from "./Shell";
import { SetPassword, SignIn } from "./SignIn";
import { applyTheme } from "./theme";
import f from "./Form.module.css";

// Each screen is its own chunk, so the first paint only carries the shell and the screen being opened.
const Dashboard = lazy(() => import("./Dashboard").then((m) => ({ default: m.Dashboard })));
const Library = lazy(() => import("./Library").then((m) => ({ default: m.Library })));
const Weight = lazy(() => import("./Weight").then((m) => ({ default: m.Weight })));
const Steps = lazy(() => import("./Steps").then((m) => ({ default: m.Steps })));
const Routines = lazy(() => import("./Routines").then((m) => ({ default: m.Routines })));
const Session = lazy(() => import("./Session").then((m) => ({ default: m.Session })));
const Settings = lazy(() => import("./Settings").then((m) => ({ default: m.Settings })));
const About = lazy(() => import("./About").then((m) => ({ default: m.About })));

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

  // Only the active route is mounted.
  const screen = (id: string) => {
    switch (id) {
      case "dashboard":
        return <Dashboard profile={p} />;
      case "log":
        return <Session profile={p} />;
      case "routines":
        return <Routines profile={p} />;
      case "library":
        return <Library profile={p} />;
      case "weight":
        return <Weight profile={p} />;
      case "steps":
        return <Steps profile={p} />;
      case "settings":
        return <Settings profile={p} />;
      case "about":
        return <About />;
    }
  };

  return (
    <Shell>
      {(route) => (
        <ErrorBoundary key={route.id}>
          <Suspense fallback={null}>{screen(route.id)}</Suspense>
        </ErrorBoundary>
      )}
    </Shell>
  );
}

export function App() {
  const session = useSession();
  const [recovering, doneRecovering] = useRecovery();
  if (!configured)
    return (
      <div className={f.center}>
        <h1 className={f.title}>Backend not configured</h1>
        <p className={f.lead}>Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY in .env.local, then restart the dev server.</p>
      </div>
    );
  if (session === undefined) return null;
  if (session && recovering) return <SetPassword onDone={doneRecovering} />;
  return session ? <Authed /> : <SignIn />;
}
