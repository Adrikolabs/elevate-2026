export type CountdownState =
  | { phase: "upcoming"; days: number; hours: number; minutes: number; seconds: number }
  | { phase: "today" }
  | { phase: "past" };

/**
 * Splits the time left until graduation into days/hours/minutes/seconds.
 * Once the moment passes it reports "today" for the rest of that calendar day
 * (in the viewer's local time) and "past" afterwards — never negative numbers.
 */
export function getCountdown(target: Date, now: Date = new Date()): CountdownState {
  const diff = target.getTime() - now.getTime();
  if (diff > 0) {
    const totalSeconds = Math.floor(diff / 1000);
    return {
      phase: "upcoming",
      days: Math.floor(totalSeconds / 86400),
      hours: Math.floor((totalSeconds % 86400) / 3600),
      minutes: Math.floor((totalSeconds % 3600) / 60),
      seconds: totalSeconds % 60,
    };
  }
  const sameDay =
    target.getFullYear() === now.getFullYear() &&
    target.getMonth() === now.getMonth() &&
    target.getDate() === now.getDate();
  return sameDay ? { phase: "today" } : { phase: "past" };
}
