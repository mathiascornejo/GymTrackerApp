import type { ReactNode } from "react";
import type { TabId } from "./routes";

const paths: Record<TabId, ReactNode> = {
  dashboard: <path d="M4 20V10m6 10V4m6 16v-7m4 7H2" />,
  log: (
    <>
      <path d="M8 4h8a2 2 0 0 1 2 2v14H6V6a2 2 0 0 1 2-2Z" />
      <path d="m9.5 12.5 2 2 3.5-4" />
    </>
  ),
  routines: (
    <>
      <rect x="4" y="5" width="16" height="15" rx="3" />
      <path d="M4 10h16M9 3v4m6-4v4" />
    </>
  ),
  weight: (
    <>
      <path d="M6.5 8h11l2 11h-15Z" />
      <circle cx="12" cy="5.5" r="2" />
      <path d="m12 12 2 3" />
    </>
  ),
  library: (
    <>
      <path d="M2.5 9.5v5m3-7v9m2.5-4.5h8m2.5-4.5v9m3-7v5" />
    </>
  ),
};

export function TabIcon({ id }: { id: TabId }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {paths[id]}
    </svg>
  );
}

export function TrashIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M10 11v6m4-6v6M6 7l1 13h10l1-13M9 7V4h6v3" />
    </svg>
  );
}
