import { describe, expect, it } from "vitest";
import { sessionsCsv, setsCsv, toCsv, type ExportSession, type ExportSet } from "./export";

describe("toCsv", () => {
  it("quotes commas, quotes and newlines", () => {
    expect(toCsv(["a", "b"], [['x,y', 'say "hi"'], ["line1\nline2", null]])).toBe('a,b\r\n"x,y","say ""hi"""\r\n"line1\nline2",\r\n');
  });
  it("defuses spreadsheet formulas in text but leaves negative numbers alone", () => {
    expect(toCsv(["n"], [["=SUM(A1)"], ["+1 call"], [-5], ["-5"], ["@home"]])).toBe("n\r\n'=SUM(A1)\r\n'+1 call\r\n-5\r\n-5\r\n'@home\r\n");
  });
});

const sessions: ExportSession[] = [{ id: "s1", started_at: "2026-10-01T10:00:00Z", ended_at: "2026-10-01T11:00:00Z", notes: "felt strong, \"good\"", routine_id: null }];
const sets: ExportSet[] = [
  { session_id: "s1", exercise_ref: "ds:A", round_index: 0, set_number: 1, weight_kg: 100, reps: 5, rpe: null, is_warmup: false, completed_at: "2026-10-01T10:05:00Z" },
  { session_id: "s1", exercise_ref: "ds:A", round_index: 0, set_number: 1, weight_kg: 40, reps: 10, rpe: 6, is_warmup: true, completed_at: "2026-10-01T10:01:00Z" },
];

describe("exports", () => {
  it("lists sets oldest first with readable names and kilograms", () => {
    const lines = setsCsv(sessions, sets, () => "Bench press").trim().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain(",Bench press,1,1,40,10,6,yes,");
    expect(lines[2]).toContain(",100,5,,no,");
  });
  it("summarises each session without counting warm-ups", () => {
    const lines = sessionsCsv(sessions, sets).trim().split("\r\n");
    expect(lines[1]).toBe('s1,2026-10-01T10:00:00Z,2026-10-01T11:00:00Z,60,1,500,"felt strong, ""good"""');
  });
});
