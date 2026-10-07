import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Crown, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { adminStudentsQuery, logAdminAction, type AdminStudent } from "@/lib/admin";
import { StudentAvatar, useDepartmentMap } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/nominees")({
  head: () => ({
    meta: [
      { title: "Manage Nominees — Elevate Academy" },
      { name: "description", content: "Manage department nominees for the Elevate Academy graduation awards." },
      { property: "og:title", content: "Manage Nominees — Elevate Academy" },
      { property: "og:description", content: "Manage department nominees for the Elevate Academy graduation awards." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AdminNominees,
});

function AdminNominees() {
  const { data, isLoading } = useQuery(adminStudentsQuery);
  const { departments } = useDepartmentMap();
  const queryClient = useQueryClient();

  const removeNominee = async (s: AdminStudent) => {
    const { error } = await supabase.from("students").update({ is_nominee: false }).eq("id", s.id);
    if (error) { toast.error("We couldn't update this nominee."); return; }
    await logAdminAction("nominee_removed", "student", s.id, `Admin unmarked ${s.full_name} as nominee.`);
    toast.success(`${s.full_name} removed from nominees`);
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  };

  if (isLoading) return <Skeleton className="h-96 rounded-2xl" />;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-extrabold">Nominees & Department Results</h2>
        <Button asChild variant="outline"><Link to="/admin/students">Add nominees from Students</Link></Button>
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        {departments.map((d) => {
          const deptStudents = (data ?? []).filter((s) => s.department_id === d.id && s.is_active);
          const nominees = deptStudents.filter((s) => s.is_nominee).sort((a, b) => Number(b.votes_received) - Number(a.votes_received));
          const voted = deptStudents.filter((s) => s.has_voted).length;
          const total = nominees.reduce((sum, n) => sum + Number(n.votes_received), 0);
          const leader = total > 0 ? nominees[0]?.id : undefined;
          return (
            <section key={d.id} className="rounded-2xl border bg-card p-6 shadow-soft">
              <h3 className="text-lg font-bold">{d.name}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {deptStudents.length} eligible · {voted} voted · {deptStudents.length ? Math.round((voted / deptStudents.length) * 100) : 0}% participation
              </p>
              <ul className="mt-4 space-y-3">
                {nominees.map((n) => {
                  const pct = total ? Math.round((Number(n.votes_received) / total) * 100) : 0;
                  return (
                    <li key={n.id} className={n.id === leader ? "rounded-xl border border-gold/60 bg-accent/50 p-3" : "rounded-xl border p-3"}>
                      <div className="flex items-center gap-3">
                        <StudentAvatar name={n.full_name} url={n.avatar_url} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 truncate text-sm font-semibold">
                            {n.id === leader && <Crown className="h-4 w-4 shrink-0 text-gold" aria-label="Current leader" />} {n.full_name}
                          </p>
                          <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-gold-gradient" style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                        <span className="w-24 text-right text-sm font-semibold tabular-nums">{n.votes_received} · {pct}%</span>
                        <Button variant="ghost" size="icon" onClick={() => removeNominee(n)} aria-label={`Remove ${n.full_name} as nominee`}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </li>
                  );
                })}
                {!nominees.length && <li className="text-sm text-muted-foreground">No nominees yet.</li>}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}
