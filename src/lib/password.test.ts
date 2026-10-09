import { describe, expect, it } from "vitest";
import { passwordProblem } from "./password";

describe("password rules", () => {
  it("rejects fewer than 8 characters", () => expect(passwordProblem("abc123")).not.toBeNull());
  it("requires a number", () => expect(passwordProblem("abcdefgh")).not.toBeNull());
  it("requires a letter", () => expect(passwordProblem("12345678")).not.toBeNull());
  it("accepts 8 chars with a letter and number", () => expect(passwordProblem("abcdefg1")).toBeNull());
});
