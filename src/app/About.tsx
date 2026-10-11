import { DATASET_SHA } from "../exercises/dataset";
import f from "./Form.module.css";
import s from "./Session.module.css";

export function About() {
  return (
    <div className={f.page}>
      <p className={f.lead}>Tempered is a personal gym tracker. Version {__APP_VERSION__ || "dev"}.</p>

      <h2 className={f.groupTitle}>Exercise data</h2>
      <p style={{ margin: 0 }}>
        The exercise list, demonstration images and instructions come from the open{" "}
        <a href="https://github.com/yuhonas/free-exercise-db">free-exercise-db</a> project by yuhonas, released under the Unlicense
        (public domain). Attribution is not required; it is given here anyway.
      </p>
      <p className={f.note}>Pinned to commit {DATASET_SHA.slice(0, 7)}. Images are served from jsDelivr.</p>

      <h2 className={f.groupTitle}>Ranks</h2>
      <p style={{ margin: 0 }}>
        Ranks compare your estimated one-rep max (the Epley formula, from working sets of 1 to 12 reps) with your bodyweight. The
        standards behind the tiers are approximate placeholders and can be edited in Settings.
      </p>

      <h2 className={f.groupTitle}>Notifications</h2>
      <p style={{ margin: 0 }}>
        The background rest alarm is a push notification, not a ringing alarm. It uses your phone's notification sound, cannot repeat,
        and follows Silent and Focus settings. On iPhone it only works from the Home Screen app.
      </p>

      <h2 className={f.groupTitle}>Your data</h2>
      <p style={{ margin: 0 }}>
        Your sessions, routines and bodyweight are stored in your own Supabase project, protected so only your account can read them. You
        can export them or delete your account in Settings.
      </p>
      <p className={s.sub} style={{ marginTop: 16 }}>
        <a href="#/settings">Back to Settings</a>
      </p>
    </div>
  );
}
