// Everything typed or chosen in an open session that is not yet a logged set. Logged sets live in the outbox and database.
export type Draft = {
  /** `${blockKey}|${itemId}|${round}` or `...|w${n}` for warm-ups -> what was typed, in the display unit. */
  inputs: Record<string, { w: string; r: string }>;
  /** blockKey -> rounds added (+) or removed (-) relative to the routine. */
  delta: Record<string, number>;
  /** `${blockKey}|${itemId}` -> warm-up rows added. */
  warm: Record<string, number>;
  /** Block keys the user skipped. */
  skipped: string[];
  /** Exercises added on the day that are not in the routine. */
  adhoc: string[];
};

export const emptyDraft = (): Draft => ({ inputs: {}, delta: {}, warm: {}, skipped: [], adhoc: [] });

const key = (sessionId: string) => `tempered.draft.${sessionId}`;

export function loadDraft(sessionId: string): Draft {
  try {
    const raw = JSON.parse(localStorage.getItem(key(sessionId)) ?? "null");
    return raw ? { ...emptyDraft(), ...raw } : emptyDraft();
  } catch {
    return emptyDraft();
  }
}

export function saveDraft(sessionId: string, d: Draft) {
  try {
    localStorage.setItem(key(sessionId), JSON.stringify(d));
  } catch {
    /* storage blocked: the draft lasts for this page load */
  }
}

export function clearDraft(sessionId: string) {
  try {
    localStorage.removeItem(key(sessionId));
  } catch {
    /* nothing to clear */
  }
}
