import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Loader2, MailCheck } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { useAuth } from "@/lib/auth";
import { Logo } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Student Login — Elevate Academy Graduation Portal" },
      { name: "description", content: "Sign in with your registered Elevate Academy email to vote and post graduation wishes." },
      { property: "og:title", content: "Student Login — Elevate Academy" },
      { property: "og:description", content: "Sign in to the Elevate Academy Class of December 2026 portal." },
    ],
  }),
  component: LoginPage,
});

const emailSchema = z.string().trim().email("Enter a valid email address").max(255);
const passwordSchema = z.string().min(8, "Password must be at least 8 characters").max(72);

function friendlyAuthError(message: string) {
  if (/invalid login credentials/i.test(message)) return "Incorrect email or password.";
  if (/email not confirmed/i.test(message)) return "Please confirm your email first — check your inbox.";
  if (/already registered/i.test(message)) return "An account with this email already exists. Try signing in.";
  if (/weak|pwned|leaked/i.test(message)) return "Please choose a stronger password.";
  return "Something went wrong. Please try again.";
}

function LoginPage() {
  const { user, ready } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");

  useEffect(() => {
    if (ready && user) navigate({ to: "/profile", replace: true });
  }, [ready, user, navigate]);

  const handle = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = emailSchema.safeParse(form.get("email"));
    if (!email.success) return toast.error(email.error.issues[0]?.message);

    setBusy(true);
    try {
      if (mode === "forgot") {
        const { error } = await supabase.auth.resetPasswordForEmail(email.data, { redirectTo: `${window.location.origin}/reset-password` });
        if (error) throw error;
        setSentTo(email.data);
        return;
      }
      const password = passwordSchema.safeParse(form.get("password"));
      if (!password.success) return toast.error(password.error.issues[0]?.message);
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email: email.data, password: password.data });
        if (error) throw error;
        toast.success("Welcome back!");
      } else {
        const { data, error } = await supabase.auth.signUp({
          email: email.data,
          password: password.data,
          options: { emailRedirectTo: `${window.location.origin}/profile` },
        });
        if (error) throw error;
        if (!data.session) setSentTo(email.data);
      }
    } catch (err) {
      toast.error(friendlyAuthError(err instanceof Error ? err.message : ""));
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin + "/login" });
    if (result.error) toast.error("Google sign-in failed. Please try again.");
  };

  return (
    <section className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-navy-gradient px-4 pb-16 pt-24">
      <div aria-hidden className="pointer-events-none absolute -left-24 top-20 h-80 w-80 rounded-full bg-gold/15 blur-3xl" />
      <div className="relative w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
        <Logo className="justify-center" />
        {sentTo ? (
          <div className="mt-8 text-center">
            <MailCheck className="mx-auto h-12 w-12 text-gold" aria-hidden />
            <h1 className="mt-4 text-2xl font-bold">Check your email</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              We sent a link to <strong className="text-foreground">{sentTo}</strong>. Open it to {mode === "forgot" ? "reset your password" : "confirm your account"}.
            </p>
            <Button variant="outline" className="mt-6" onClick={() => { setSentTo(null); setMode("signin"); }}>
              Back to sign in
            </Button>
          </div>
        ) : (
          <>
            <h1 className="mt-6 text-center text-2xl font-bold">
              {mode === "forgot" ? "Reset your password" : "Student & Admin Login"}
            </h1>
            <p className="mt-1 text-center text-sm text-muted-foreground">
              Use the email address registered with Elevate Academy.
            </p>
            {mode !== "forgot" ? (
              <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")} className="mt-6">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="signin">Sign in</TabsTrigger>
                  <TabsTrigger value="signup">Activate account</TabsTrigger>
                </TabsList>
                <TabsContent value={mode}>
                  <form onSubmit={handle} className="mt-4 space-y-4" noValidate>
                    <div className="space-y-1.5">
                      <Label htmlFor="email">Email</Label>
                      <Input id="email" name="email" type="email" autoComplete="email" required />
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="password">{mode === "signup" ? "Create a password" : "Password"}</Label>
                        {mode === "signin" && (
                          <button type="button" className="text-xs font-medium text-royal hover:underline" onClick={() => setMode("forgot")}>
                            Forgot password?
                          </button>
                        )}
                      </div>
                      <Input id="password" name="password" type="password" autoComplete={mode === "signup" ? "new-password" : "current-password"} required minLength={8} />
                    </div>
                    {mode === "signup" && (
                      <p className="text-xs text-muted-foreground">
                        First time here? Your email must already be registered by Elevate Academy to get student access.
                      </p>
                    )}
                    <Button type="submit" variant="navy" className="w-full" disabled={busy}>
                      {busy && <Loader2 className="h-4 w-4 animate-spin" />} {mode === "signin" ? "Sign in" : "Activate account"}
                    </Button>
                  </form>
                </TabsContent>
              </Tabs>
            ) : (
              <form onSubmit={handle} className="mt-6 space-y-4" noValidate>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" name="email" type="email" autoComplete="email" required />
                </div>
                <Button type="submit" variant="navy" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />} Send reset link
                </Button>
                <button type="button" className="w-full text-sm text-muted-foreground hover:underline" onClick={() => setMode("signin")}>
                  Back to sign in
                </button>
              </form>
            )}
            {mode !== "forgot" && (
              <>
                <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="h-px flex-1 bg-border" /> or <span className="h-px flex-1 bg-border" />
                </div>
                <Button type="button" variant="outline" className="w-full" onClick={google}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden><path fill="currentColor" d="M21.35 11.1H12v2.8h5.35c-.25 1.45-1.65 4.25-5.35 4.25a5.9 5.9 0 0 1 0-11.8c1.85 0 3.1.8 3.8 1.45l2.6-2.5C16.75 3.75 14.6 2.8 12 2.8a9.2 9.2 0 0 0 0 18.4c5.3 0 8.8-3.7 8.8-8.95 0-.6-.05-1.05-.15-1.15Z" /></svg>
                  Continue with Google
                </Button>
              </>
            )}
            <p className="mt-6 text-center text-xs text-muted-foreground">
              <Link to="/" className="hover:underline">← Back to the portal</Link>
            </p>
          </>
        )}
      </div>
    </section>
  );
}
