import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { departmentsQuery, hubsQuery } from "@/lib/data";
import { passwordProblem, passwordStrength } from "@/lib/password";
import { Logo } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Student Registration — Elevate Academy Graduation Portal" },
      { name: "description", content: "Create your Elevate Academy Class of 2026 student account and verify your email." },
      { property: "og:title", content: "Register — Elevate Academy Graduation Portal" },
      { property: "og:description", content: "Create your Elevate Academy graduation portal account." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: RegisterPage,
});

const selectCls = "flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function RegisterPage() {
  const navigate = useNavigate();
  const hubs = useQuery(hubsQuery);
  const depts = useQuery(departmentsQuery);
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [exists, setExists] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setExists(false);
    const f = new FormData(e.currentTarget);
    const fullName = String(f.get("full_name") ?? "").trim();
    const email = z.string().trim().toLowerCase().email().max(255).safeParse(f.get("email"));
    const confirm = String(f.get("confirm") ?? "");
    const hubId = String(f.get("hub_id") ?? "");
    const deptId = String(f.get("department_id") ?? "");
    const studentCode = String(f.get("student_code") ?? "").trim();
    if (fullName.length < 2) return toast.error("Enter your full name.");
    if (!email.success) return toast.error("Enter a valid email address.");
    const prob = passwordProblem(pw);
    if (prob) return toast.error(prob);
    if (pw !== confirm) return toast.error("Passwords do not match.");
    if (!hubId) return toast.error("Choose your Elevate Academy Hub.");
    if (!deptId) return toast.error("Choose your course.");

    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: email.data,
      password: pw,
      options: {
        emailRedirectTo: window.location.origin + "/profile",
        data: { full_name: fullName, hub_id: hubId, department_id: deptId, student_code: studentCode },
      },
    });
    setBusy(false);
    if (error) {
      if (/already|registered|exists/i.test(error.message)) return setExists(true);
      if (/weak|pwned|leaked/i.test(error.message)) return toast.error("This password is too common. Please choose a stronger one.");
      return toast.error("We couldn't create your account. Please try again.");
    }
    // An existing confirmed email returns a user with no identities.
    if (data.user && data.user.identities?.length === 0) return setExists(true);
    navigate({ to: "/verify-email", search: { email: email.data } });
  };

  const strength = passwordStrength(pw);

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy-gradient px-4 pb-16 pt-24">
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
        <Logo className="justify-center" />
        <h1 className="mt-6 text-center text-2xl font-bold">Create your student account</h1>
        <p className="mt-1 text-center text-sm text-muted-foreground">Your email will be your username.</p>
        <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
          <div className="space-y-1.5"><Label htmlFor="full_name">Full Name</Label><Input id="full_name" name="full_name" autoComplete="name" maxLength={120} required /></div>
          <div className="space-y-1.5"><Label htmlFor="email">Email Address</Label><Input id="email" name="email" type="email" autoComplete="email" required /></div>
          <div className="space-y-1.5">
            <Label htmlFor="password">Password</Label>
            <div className="relative">
              <Input id="password" type={show ? "text" : "password"} value={pw} onChange={(e) => setPw(e.target.value)} autoComplete="new-password" className="pr-10" required />
              <button type="button" onClick={() => setShow((s) => !s)} className="absolute inset-y-0 right-0 flex w-10 items-center justify-center text-muted-foreground" aria-label={show ? "Hide password" : "Show password"}>
                {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <div className="flex gap-1" aria-hidden>{[1, 2, 3, 4].map((i) => <span key={i} className={`h-1 flex-1 rounded ${pw && strength >= i ? "bg-primary" : "bg-muted"}`} />)}</div>
            <p className="text-xs text-muted-foreground">At least 8 characters with a letter and a number. Adding uppercase and a symbol makes it stronger.</p>
          </div>
          <div className="space-y-1.5"><Label htmlFor="confirm">Confirm Password</Label><Input id="confirm" name="confirm" type={show ? "text" : "password"} autoComplete="new-password" required /></div>
          <div className="space-y-1.5">
            <Label htmlFor="hub_id">Select Your Hub</Label>
            <select id="hub_id" name="hub_id" className={selectCls} defaultValue="" required>
              <option value="" disabled>Choose your Elevate Academy Hub</option>
              {(hubs.data ?? []).filter((h) => h.is_active).map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="department_id">Course / Department</Label>
            <select id="department_id" name="department_id" className={selectCls} defaultValue="" required>
              <option value="" disabled>Choose your course</option>
              {(depts.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
            </select>
          </div>
          <div className="space-y-1.5"><Label htmlFor="student_code">Student ID <span className="text-muted-foreground">(optional)</span></Label><Input id="student_code" name="student_code" maxLength={40} autoComplete="off" /></div>
          {exists && (
            <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
              <p className="font-bold text-destructive">An account already exists with this email address.</p>
              <p className="mt-0.5 text-muted-foreground">Please log in instead.</p>
              <div className="mt-2 flex gap-3 text-sm font-medium">
                <Link to="/login" className="text-primary hover:underline">Go to Login</Link>
                <Link to="/login" className="text-primary hover:underline">Forgot Password?</Link>
              </div>
            </div>
          )}
          <Button type="submit" variant="navy" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Create account</Button>
        </form>
        <p className="mt-6 text-center text-sm text-muted-foreground">Already registered? <Link to="/login" className="font-medium text-primary hover:underline">Sign in</Link></p>
      </div>
    </section>
  );
}
