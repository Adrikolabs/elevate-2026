import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/verify-email")({
  validateSearch: z.object({ email: z.string().email().max(255).optional().catch(undefined) }),
  head: () => ({
    meta: [
      { title: "Verify Your Email — Elevate Academy Graduation Portal" },
      { name: "description", content: "Enter the verification code sent to your email to activate your Elevate Academy account." },
      { property: "og:title", content: "Verify Your Email — Elevate Academy" },
      { property: "og:description", content: "Complete your Elevate Academy registration." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: VerifyEmail,
});

const LEN = 6;
const COOLDOWN = 60;

function VerifyEmail() {
  const { email } = Route.useSearch();
  const navigate = useNavigate();
  const [digits, setDigits] = useState<string[]>(Array(LEN).fill(""));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<"invalid" | "expired" | null>(null);
  const [done, setDone] = useState(false);
  const [wait, setWait] = useState(COOLDOWN);
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  if (!email) {
    return (
      <Shell>
        <p className="mt-6 text-center text-sm text-muted-foreground">Start by creating your account.</p>
        <Button asChild variant="navy" className="mt-4 w-full"><Link to="/register">Go to registration</Link></Button>
      </Shell>
    );
  }

  const setAt = (i: number, v: string) => {
    const chars = v.replace(/\D/g, "").split("");
    if (!chars.length) { setDigits((d) => d.map((x, j) => (j === i ? "" : x))); return; }
    setDigits((d) => {
      const n = [...d];
      chars.slice(0, LEN - i).forEach((c, k) => (n[i + k] = c));
      return n;
    });
    refs.current[Math.min(i + chars.length, LEN - 1)]?.focus();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    const token = digits.join("");
    if (token.length !== LEN) { setError("invalid"); return; }
    setBusy(true); setError(null);
    const { error: err } = await supabase.auth.verifyOtp({ email, token, type: "signup" });
    setBusy(false);
    if (err) { setError(/expired/i.test(err.message) ? "expired" : "invalid"); return; }
    setDone(true);
  };

  const resend = async () => {
    setWait(COOLDOWN);
    const { error: err } = await supabase.auth.resend({ type: "signup", email });
    if (err) toast.error(/rate|seconds/i.test(err.message) ? "Please wait a little before requesting another code." : "We couldn't send a new code. Please try again.");
    else { toast.success("A new code has been sent."); setDigits(Array(LEN).fill("")); setError(null); }
  };

  if (done) {
    return (
      <Shell>
        <div className="mt-6 text-center">
          <CheckCircle2 className="mx-auto h-12 w-12 text-primary" aria-hidden />
          <h1 className="mt-4 text-2xl font-bold">Registration Successful 🎉</h1>
          <p className="mt-2 text-sm text-muted-foreground">Your Elevate Academy student account has been verified successfully.</p>
          <Button variant="navy" className="mt-6 w-full" onClick={() => navigate({ to: "/profile" })}>Continue to Student Portal</Button>
        </div>
      </Shell>
    );
  }

  return (
    <Shell>
      <h1 className="mt-6 text-center text-2xl font-bold">Verify Your Email</h1>
      <p className="mt-2 text-center text-sm text-muted-foreground">
        We sent a verification code to <strong className="text-foreground">{email}</strong>. Enter the code below to complete your Elevate Academy registration.
      </p>
      <form onSubmit={verify} className="mt-6 space-y-4">
        <div className="flex justify-center gap-2" aria-label="Verification Code">
          {digits.map((d, i) => (
            <input
              key={i}
              ref={(el) => { refs.current[i] = el; }}
              value={d}
              inputMode="numeric"
              autoComplete={i === 0 ? "one-time-code" : "off"}
              aria-label={`Digit ${i + 1}`}
              onChange={(e) => setAt(i, e.target.value)}
              onKeyDown={(e) => { if (e.key === "Backspace" && !d && i > 0) refs.current[i - 1]?.focus(); }}
              onPaste={(e) => { e.preventDefault(); setAt(i, e.clipboardData.getData("text")); }}
              className="h-12 w-11 rounded-lg border border-input bg-background text-center text-lg font-bold focus:outline-none focus:ring-2 focus:ring-ring"
            />
          ))}
        </div>
        {error && (
          <div role="alert" className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-sm">
            {error === "expired" ? (
              <><p className="font-bold text-destructive">Code expired</p><p className="mt-0.5 text-muted-foreground">This verification code has expired. Request a new code to continue.</p></>
            ) : (
              <><p className="font-bold text-destructive">Invalid Verification Code</p><p className="mt-0.5 text-muted-foreground">The code you entered is incorrect or has expired. Please check the code and try again.</p></>
            )}
          </div>
        )}
        <Button type="submit" variant="navy" className="w-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />} Verify Account</Button>
      </form>
      <div className="mt-4 text-center text-sm">
        {wait > 0 ? (
          <p className="text-muted-foreground">You can request another code in {wait} seconds.</p>
        ) : (
          <button type="button" onClick={resend} className="font-medium text-primary hover:underline">Resend Verification Code</button>
        )}
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <section className="relative flex min-h-[100svh] items-center justify-center bg-navy-gradient px-4 pb-16 pt-24">
      <div className="w-full max-w-md rounded-3xl border bg-card p-6 shadow-lift sm:p-8">
        <Logo className="justify-center" />
        {children}
      </div>
    </section>
  );
}
