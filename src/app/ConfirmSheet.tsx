import { Sheet } from "./ExerciseSheet";
import f from "./Form.module.css";
import s from "./Library.module.css";

/** The app's yes/no popup, in place of the browser's window.confirm. */
export function ConfirmSheet({
  open, title, body, confirmLabel, onConfirm, onClose, destructive,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  destructive?: boolean;
}) {
  return (
    <Sheet open={open} onClose={onClose} label={title}>
      <h2 className={s.sheetTitle}>{title}</h2>
      <p style={{ margin: "0 0 16px" }}>{body}</p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        <button type="button" className={destructive ? `${f.button} ${f.danger}` : f.button} onClick={onConfirm}>{confirmLabel}</button>
        <button type="button" className={f.quiet} onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
