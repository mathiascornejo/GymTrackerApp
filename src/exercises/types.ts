export type Exercise = {
  /** `ds:<dataset id>` or `custom:<uuid>`; the same string is stored in block_items and session_sets. */
  ref: string;
  name: string;
  primary: string[];
  secondary: string[];
  equipment: string | null;
  force: string | null;
  mechanic: string | null;
  level: string | null;
  category: string | null;
  instructions: string[];
  /** Absolute image URLs (start and end position); empty for custom exercises. */
  images: string[];
  custom: boolean;
};

export type Filters = Partial<Record<"muscle" | "equipment" | "level" | "force" | "mechanic" | "category", string>>;
