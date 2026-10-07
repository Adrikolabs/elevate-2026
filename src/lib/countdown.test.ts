import { describe, expect, it } from "vitest";
import { getCountdown } from "./countdown";
import { voteErrorMessage, GENERIC_VOTE_ERROR } from "./vote-errors";

describe("graduation countdown", () => {
  it("splits remaining time into days, hours, minutes and seconds", () => {
    const now = new Date(2026, 9, 28, 1, 27, 46);
    const target = new Date(2026, 11, 12, 10, 0, 0);
    // 45 days 8h 32m 14s
    expect(getCountdown(target, now)).toEqual({
      phase: "upcoming",
      days: 45,
      hours: 8,
      minutes: 32,
      seconds: 14,
    });
  });

  it("shows graduation day instead of negative numbers on the day itself", () => {
    const target = new Date(2026, 11, 12, 10, 0, 0);
    expect(getCountdown(target, new Date(2026, 11, 12, 15, 0, 0))).toEqual({ phase: "today" });
  });

  it("reports past after graduation day", () => {
    const target = new Date(2026, 11, 12, 10, 0, 0);
    expect(getCountdown(target, new Date(2026, 11, 13, 9, 0, 0))).toEqual({ phase: "past" });
  });
});

describe("vote error messages", () => {
  it("explains cross-department votes are not allowed", () => {
    expect(voteErrorMessage({ message: "WRONG_DEPARTMENT" })).toBe(
      "You can only vote for nominees in your own department.",
    );
  });
  it("explains a second vote is not allowed", () => {
    expect(voteErrorMessage({ message: "ALREADY_VOTED" })).toBe("You have already submitted your vote.");
  });
  it("never exposes raw database errors", () => {
    expect(voteErrorMessage({ message: 'duplicate key value violates unique constraint "x"' })).toBe(
      GENERIC_VOTE_ERROR,
    );
  });
});
