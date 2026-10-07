import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import confetti from "canvas-confetti";
import { Award, CheckCircle2, Loader2, Lock, Vote } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { projectsQuery, settingsQuery, STUDENT_PUBLIC_COLUMNS, type PublicStudent } from "@/lib/data";
import { voteErrorMessage } from "@/lib/vote-errors";
import { NotRegisteredNotice } from "@/components/common/AccountNotice";
import { CardGridSkeleton, DepartmentBadge, EmptyState, PageHeader, StudentAvatar } from "@/components/common/primitives";
import { ProjectCover } from "@/components/projects/ProjectCard";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/vote")({
  head: () => ({
    meta: [
      { title: "Vote — Elevate Academy Graduation Awards" },
      { name: "description", content: "Vote for your favourite student in your own department." },
      { property: "og:title", content: "Vote — Elevate Academy Graduation Awards" },
      { property: "og:description", content: "Cast your one vote for your department's favourite student." },
    ],
  }),
  component: VotePage,
});

function VotePage() {
  const { student, studentLoading } = useAuth();
  const { data: settings } = useQuery(settingsQuery);
  const { data: projects } = useQuery(projectsQuery);
  const queryClient = useQueryClient();
  const [selected, setSelected] = useState<PublicStudent | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const nominees = useQuery({
    queryKey: ["nominees", student?.department_id],
    enabled: !!student?.department_id,
    queryFn: async (): Promise<PublicStudent[]> => {
      const { data, error } = await supabase
        .from("students")
        .select(STUDENT_PUBLIC_COLUMNS)
        .eq("department_id", student!.department_id!)
        .eq("is_nominee", true)
        .eq("is_active", true)
        .order("full_name");
      if (error) throw error;
      return data as PublicStudent[];
    },
  });

  if (studentLoading) {
    return (
      <>
        <PageHeader eyebrow="Graduation Awards" title="Vote" />
        <div className="mx-auto max-w-7xl px-4 py-10"><CardGridSkeleton count={3} /></div>
      </>
    );
  }
  if (!student) {
    return (
      <>
        <PageHeader eyebrow="Graduation Awards" title="Vote" />
        <div className="px-4 py-12"><NotRegisteredNotice /></div>
      </>
    );
  }

  const confirmVote = async () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    setError(null);
    const { error: err } = await supabase.rpc("cast_vote", { _nominee_id: selected.id });
    setSubmitting(false);
    if (err) {
      setError(voteErrorMessage(err));
      if (/ALREADY_VOTED/.test(err.message)) queryClient.invalidateQueries({ queryKey: ["me"] });
      return;
    }
    setSuccess(selected.full_name);
    setSelected(null);
    confetti({ particleCount: 160, spread: 90, colors: getComputedStyle(document.documentElement).getPropertyValue("--confetti-colors").split(",").map((color) => color.trim()), origin: { y: 0.5 } });
    queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const dept = student.department_name ?? "your department";

  let body: React.ReactNode;
  if (!student.department_id) {
    body = <EmptyState title="Invalid Department" description="Your student account has not been assigned to a department. Please contact Elevate Academy." />;
  } else if (student.has_voted) {
    body = (
      <EmptyState
        icon={CheckCircle2}
        title="You have already submitted your vote."
        description="Thank you for participating in the Elevate Academy Graduation Awards."
        action={<Button asChild variant="navy"><Link to="/projects">Explore projects</Link></Button>}
      />
    );
  } else if (settings && !settings.voting_open) {
    body = <EmptyState icon={Lock} title="Voting is currently closed." description="Please check back when voting opens." />;
  } else if (nominees.isLoading) {
    body = <CardGridSkeleton count={3} />;
  } else {
    const list = (nominees.data ?? []).filter((n) => n.id !== student.id);
    body = list.length ? (
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((n) => {
          const work = (projects ?? []).find((p) => p.student_id === n.id);
          return (
            <article key={n.id} className="flex flex-col overflow-hidden rounded-2xl border bg-card shadow-soft transition-all hover:-translate-y-1 hover:shadow-lift">
              <div className="aspect-[16/9] overflow-hidden bg-muted">
                {work ? <ProjectCover project={work} /> : <div className="h-full w-full bg-navy-gradient" />}
              </div>
              <div className="flex flex-1 flex-col p-5">
                <div className="-mt-12 flex items-end gap-3">
                  <StudentAvatar name={n.full_name} url={n.avatar_url} size="lg" className="ring-4 ring-card" />
                </div>
                <h3 className="mt-3 text-lg font-bold">{n.full_name}</h3>
                <DepartmentBadge departmentId={n.department_id} className="mt-1 self-start" />
                <p className="mt-3 line-clamp-3 flex-1 text-sm text-muted-foreground">{n.bio}</p>
                {work && <p className="mt-3 text-xs font-medium text-royal">Featured work: {work.title}</p>}
                <Button variant="gold" className="mt-5 w-full" onClick={() => { setError(null); setSelected(n); }}>
                  <Vote className="h-4 w-4" /> Vote for {n.full_name.split(" ")[0]}
                </Button>
              </div>
            </article>
          );
        })}
      </div>
    ) : (
      <EmptyState title="No nominees are currently available for your department." />
    );
  }

  return (
    <>
      <PageHeader
        eyebrow="Graduation Awards"
        title={`Vote: ${dept}`}
        description={`${student.full_name} – ${dept}. You can vote once, only for a nominee in your own department.`}
      />
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">{body}</div>

      <AlertDialog open={!!selected} onOpenChange={(o) => !o && !submitting && setSelected(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Your Vote</AlertDialogTitle>
            <AlertDialogDescription>
              You are voting for <strong className="text-foreground">{selected?.full_name}</strong> as your favorite student in{" "}
              <strong className="text-foreground">{dept}</strong>. This vote cannot be changed after submission.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {error && <p className="rounded-lg bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <Button variant="gold" onClick={confirmVote} disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />} Confirm Vote
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={!!success} onOpenChange={(o) => !o && setSuccess(null)}>
        <DialogContent className="text-center">
          <DialogHeader>
            <Award className="mx-auto h-14 w-14 text-gold" aria-hidden />
            <DialogTitle className="text-center text-2xl">Vote Recorded Successfully 🎉</DialogTitle>
            <DialogDescription className="text-center">
              Thank you for participating in the Elevate Academy Graduation Awards.
            </DialogDescription>
          </DialogHeader>
          <Button asChild variant="navy"><Link to="/profile">Back to my dashboard</Link></Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
