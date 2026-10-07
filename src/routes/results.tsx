import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Crown, Trophy } from "lucide-react";
import { publicResultsQuery, settingsQuery } from "@/lib/data";
import { EmptyState, PageHeader, StudentAvatar, useDepartmentMap } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/results")({
  head: () => ({
    meta: [
      { title: "Graduation Awards Results — Elevate Academy" },
      { name: "description", content: "Department award results for the Elevate Academy Class of December 2026." },
      { property: "og:title", content: "Graduation Awards Results — Elevate Academy" },
      { property: "og:description", content: "See the favourite students voted by each department." },
    ],
  }),
  component: ResultsPage,
});

function ResultsPage() {
  const { data: settings, isLoading: sLoading } = useQuery(settingsQuery);
  const { data: results, isLoading } = useQuery({ ...publicResultsQuery, enabled: !!settings?.public_results_enabled });
  const { departments } = useDepartmentMap();

  return (
    <>
      <PageHeader eyebrow="Graduation Awards" title="Award Results" />
      <div className="mx-auto max-w-5xl px-4 py-12 sm:px-6">
        {sLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : !settings?.public_results_enabled ? (
          <EmptyState icon={Trophy} title="Results will be announced during the graduation ceremony." />
        ) : isLoading ? (
          <Skeleton className="h-40 w-full rounded-2xl" />
        ) : (
          <div className="space-y-8">
            {departments.map((d) => {
              const rows = (results ?? []).filter((r) => r.department_id === d.id).sort((a, b) => Number(b.vote_count) - Number(a.vote_count));
              if (!rows.length) return null;
              const total = rows.reduce((s, r) => s + Number(r.vote_count), 0);
              return (
                <section key={d.id} className="rounded-2xl border bg-card p-6 shadow-soft">
                  <h2 className="text-xl font-bold">{d.name}</h2>
                  <ul className="mt-4 space-y-3">
                    {rows.map((r, i) => {
                      const pct = total ? Math.round((Number(r.vote_count) / total) * 100) : 0;
                      return (
                        <li key={r.nominee_id} className="flex items-center gap-3">
                          <StudentAvatar name={r.full_name} url={r.avatar_url} size="sm" />
                          <div className="flex-1">
                            <div className="flex items-center justify-between text-sm">
                              <span className="flex items-center gap-1.5 font-semibold">
                                {i === 0 && total > 0 && <Crown className="h-4 w-4 text-gold" aria-label="Winner" />} {r.full_name}
                              </span>
                              <span className="text-muted-foreground">{r.vote_count} votes · {pct}%</span>
                            </div>
                            <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-muted">
                              <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
                            </div>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
