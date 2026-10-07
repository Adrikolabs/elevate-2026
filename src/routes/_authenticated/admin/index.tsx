import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Award, Building2, CheckCircle2, FolderOpen, MessageSquareHeart, Percent, UserCheck, Users, UserX } from "lucide-react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { adminCountsQuery, adminStudentsQuery } from "@/lib/admin";
import { settingsQuery } from "@/lib/data";
import { useDepartmentMap } from "@/components/common/primitives";
import { Skeleton } from "@/components/ui/skeleton";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminDashboard,
});

function Stat({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-soft">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-muted-foreground">{label}</p>
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent text-gold"><Icon className="h-4 w-4" aria-hidden /></span>
      </div>
      <p className="mt-3 font-display text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function AdminDashboard() {
  const students = useQuery(adminStudentsQuery);
  const counts = useQuery(adminCountsQuery);
  const { data: settings } = useQuery(settingsQuery);
  const { departments } = useDepartmentMap();

  if (students.isLoading || counts.isLoading) {
    return (
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }
  if (students.error) return <p className="text-destructive">You do not have permission to view this data.</p>;

  const all = students.data ?? [];
  const active = all.filter((s) => s.is_active);
  const eligible = active.filter((s) => s.department_id);
  const voted = eligible.filter((s) => s.has_voted).length;
  const participation = eligible.length ? ((voted / eligible.length) * 100).toFixed(1) : "0.0";

  const chart = departments.map((d) => {
    const deptEligible = eligible.filter((s) => s.department_id === d.id);
    const deptVoted = deptEligible.filter((s) => s.has_voted).length;
    return { name: d.name.replace("Fundamentals of ", ""), votes: deptVoted, eligible: deptEligible.length };
  });

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-2xl font-extrabold">Overview</h2>
        <span className={settings?.voting_open ? "rounded-full bg-success/15 px-3 py-1 text-xs font-bold text-success" : "rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground"}>
          Voting {settings?.voting_open ? "open" : "closed"}
        </span>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Stat icon={Users} label="Registered students" value={all.length} />
        <Stat icon={UserCheck} label="Active students" value={active.length} />
        <Stat icon={Building2} label="Departments" value={departments.length} />
        <Stat icon={Award} label="Nominees" value={active.filter((s) => s.is_nominee).length} />
        <Stat icon={CheckCircle2} label="Votes cast" value={counts.data?.votes.length ?? 0} />
        <Stat icon={UserX} label="Yet to vote" value={eligible.length - voted} />
        <Stat icon={FolderOpen} label="Projects" value={counts.data?.projects ?? 0} />
        <Stat icon={MessageSquareHeart} label="Graduation messages" value={counts.data?.messages ?? 0} />
      </div>
      <div className="grid gap-6 xl:grid-cols-[1fr_280px]">
        <div className="rounded-2xl border bg-card p-6 shadow-soft">
          <h3 className="font-bold">Voting Participation by Department</h3>
          <div className="mt-6 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chart}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} angle={-15} textAnchor="end" height={50} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="eligible" name="Eligible" fill="var(--color-chart-3)" radius={[6, 6, 0, 0]} />
                <Bar dataKey="votes" name="Voted" fill="var(--color-chart-2)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="flex flex-col justify-center rounded-2xl bg-navy-gradient p-6 text-navy-foreground shadow-soft">
          <Percent className="h-6 w-6 text-gold-warm" aria-hidden />
          <p className="mt-4 text-sm text-navy-foreground/70">Overall participation</p>
          <p className="font-display text-5xl font-extrabold text-gold-warm">{participation}%</p>
          <p className="mt-2 text-sm text-navy-foreground/70">{voted} of {eligible.length} eligible students have voted.</p>
        </div>
      </div>
    </div>
  );
}
