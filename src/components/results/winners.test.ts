import { describe, expect, it } from "vitest";
import { pickWinners } from "./WinnersSection";
const r = (d: string, id: string, v: number) => ({ department_id: d, nominee_id: id, full_name: id, avatar_url: null, vote_count: v });
describe("pickWinners", () => {
  it("picks the top-voted nominee per department", () => {
    const w = pickWinners([r("a", "x", 3), r("a", "y", 5), r("b", "z", 2)]);
    expect(w.get("a")!.map((x) => x.nominee_id)).toEqual(["y"]);
    expect(w.get("b")!.map((x) => x.nominee_id)).toEqual(["z"]);
  });
  it("ties share the win", () => expect(pickWinners([r("a", "x", 4), r("a", "y", 4)]).get("a")!.length).toBe(2));
  it("no winner with zero votes", () => expect(pickWinners([r("a", "x", 0)]).has("a")).toBe(false));
});
