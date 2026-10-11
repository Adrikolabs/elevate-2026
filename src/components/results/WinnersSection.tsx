import { useQuery } from "@tanstack/react-query";
import { Trophy } from "lucide-react";
import { departmentsQuery, publicResultsQuery, settingsQuery } from "@/lib/data";
import { SectionHeading, StudentAvatar } from "@/components/common/primitives";

type Row = { department_id: string; nominee_id: string; full_name: string; avatar_url: string | null; vote_count: number };

/** Picks the top-voted nominee(s) per department; ties share the win. */
export function pickWinners(rows: Row[]) {
  const byDept = new Map<string, Row[]>();
  for (const r of rows) {
    const list = byDept.get(r.department_id) ?? [];
    list.push(r);
    byDept.set(r.department_id, list);
  }
  const out = new Map<string, Row[]>();
  for (const [dept, list] of byDept) {
    const max = Math.max(...list.map((r) => Number(r.vote_count)));
    if (max > 0) out.set(dept, list.filter((r) => Number(r.vote_count) === max));
  }
  return out;
}

/** Shown on the homepage only after the admin publishes results. */
export function WinnersSection() {
  const { data: settings } = useQuery(settingsQuery);
  const enabled = !!settings?.public_results_enabled;
  const results = useQuery({ ...publicResultsQuery, enabled });
  const departments = useQuery(departmentsQuery);
  if (!enabled || !results.data) return null;
  const winners = pickWinners(results.data as Row[]);
  if (winners.size === 0) return null;

  return (
    <section className="bg-secondary/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <SectionHeading eyebrow="Graduation Awards 2026" title="🏆 Our Winners" description="Congratulations to the students voted favourite in each department!" />
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(departments.data ?? []).filter((d) => winners.has(d.id)).map((d) =>
            winners.get(d.id)!.map((w) => (
              <article key={w.nominee_id} className="relative flex flex-col items-center rounded-3xl border bg-card p-6 text-center shadow-lift">
                <Trophy className="absolute right-4 top-4 h-6 w-6 text-primary" aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{d.name}</p>
                <StudentAvatar name={w.full_name} url={w.avatar_url} size="lg" className="mt-4 ring-4 ring-primary/30" />
                <h3 className="mt-4 text-xl font-extrabold">{w.full_name}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{w.vote_count} vote{Number(w.vote_count) === 1 ? "" : "s"}</p>
              </article>
            )),
          )}
        </div>
      </div>
    </section>
  );
}
