import { Shell } from "./Shell";
import s from "./Placeholder.module.css";

// Tab content arrives in later phases; only the active tab is mounted.
export function App() {
  return <Shell>{(tab) => <p className={s.empty}>{tab.hint}</p>}</Shell>;
}
