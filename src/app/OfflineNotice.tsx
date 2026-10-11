import { useSyncExternalStore } from "react";
import f from "./Form.module.css";

const subscribe = (cb: () => void) => {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
};

/** A quiet note, not an alarm: it says what still works and what waits for a connection. */
export function OfflineNotice() {
  const online = useSyncExternalStore(subscribe, () => navigator.onLine, () => true);
  if (online) return null;
  return (
    <p className={f.note} role="status" style={{ margin: "0 0 12px", padding: "8px 12px", border: "1px solid var(--hairline)", borderRadius: 12 }}>
      You're offline. Sets you log are saved on this device and sync when you reconnect. Starting a session and saving routine changes
      need a connection.
    </p>
  );
}
