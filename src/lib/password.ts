/** Returns an error message, or null when the password meets the minimum rules (8+ chars, a letter, a number). */
export function passwordProblem(pw: string): string | null {
  if (pw.length < 8) return "Password must be at least 8 characters.";
  if (pw.length > 72) return "Password must be at most 72 characters.";
  if (!/[A-Za-z]/.test(pw)) return "Password must contain at least one letter.";
  if (!/\d/.test(pw)) return "Password must contain at least one number.";
  return null;
}

/** 0–4 strength score encouraging upper, lower, number and symbol. */
export function passwordStrength(pw: string): number {
  return [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(pw)).length;
}
