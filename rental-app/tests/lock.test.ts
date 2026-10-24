import { describe, expect, it } from "vitest";
import { freshDb } from "./helpers";
import { createPass } from "../core/shell/lock";

// With a company password, opening a program from the chooser restarts the app:
// the restart gets a one-time pass so the password isn't asked twice.

describe("the one-time pass", () => {
  it("lets the program the chooser opened start without asking again — once, and only soon after", () => {
    let t = 1_000_000;
    const pass = createPass({ db: freshDb(), now: () => t });
    const first = pass.issue();
    expect(pass.take("wrong")).toBe(false);
    // a wrong try uses it up
    expect(pass.take(first)).toBe(false);
    const again = pass.issue();
    expect(pass.take(again)).toBe(true);
    expect(pass.take(again)).toBe(false);
    const late = pass.issue();
    t += 3 * 60 * 1000;
    expect(pass.take(late)).toBe(false);
  });
});
