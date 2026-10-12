import { useEffect, useState } from "react";
import { disablePush, enablePush, lastAlarmDelayS, usePushState } from "../data/push";
import f from "./Form.module.css";

export function AlarmSettings() {
  const [state, refresh] = usePushState();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [delay, setDelay] = useState<number | null>(null);

  useEffect(() => {
    if (state === "on") void lastAlarmDelayS().then(setDelay);
  }, [state]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
      refresh();
    }
  };

  return (
    <section className={f.card}>
      <h2 className={f.cardTitle}>Rest alarm in the background</h2>
      <div className={f.group}>
        <div className={f.stack}>
          {state === null && <p className={f.note}>Checking notification support.</p>}

          {state === "on" && (
            <>
              <p style={{ margin: 0 }}>Notifications are on. A notification arrives when your rest ends, even with the phone locked.</p>
              {delay !== null && <p className={f.note}>The last background alarm arrived {delay} s after its timer ended.</p>}
              <button type="button" className={f.quiet} disabled={busy} onClick={() => void run(disablePush)}>Turn off notifications</button>
            </>
          )}

          {state === "ready" && (
            <>
              <p style={{ margin: 0 }}>Turn on notifications to be alerted when a rest ends while the app is closed or the phone is locked.</p>
              <button type="button" className={f.button} disabled={busy} onClick={() => void run(enablePush)}>Turn on notifications</button>
            </>
          )}

          {state === "needs-install" && (
            <>
              <p style={{ margin: 0 }}>On iPhone and iPad, notifications only work once Tempered is on your Home Screen.</p>
              <ol className={f.note} style={{ margin: 0, paddingLeft: 20, display: "grid", gap: 4 }}>
                <li>Open this page in Safari.</li>
                <li>Tap the Share button, then Add to Home Screen.</li>
                <li>Open Tempered from the Home Screen icon.</li>
                <li>Come back to Settings and turn on notifications.</li>
              </ol>
            </>
          )}

          {state === "denied" && (
            <p style={{ margin: 0 }}>Notifications are blocked for Tempered. Allow them in your browser or phone settings, then reopen this screen.</p>
          )}
          {state === "unsupported" && <p style={{ margin: 0 }}>This browser cannot receive background notifications. The on-screen timer still works.</p>}
          {state === "unconfigured" && <p style={{ margin: 0 }}>Background notifications are not set up in this build of the app.</p>}

          {error && <p className={f.error} role="alert">{error}</p>}

          <p className={f.note}>
            This is a notification, not a ringing alarm. It uses your phone's notification sound, cannot repeat, and follows Silent and
            Focus settings. Timing is best effort: usually within a few seconds, and it can be later.
          </p>
        </div>
      </div>
    </section>
  );
}
