import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/common/primitives";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Set a New Password — Elevate Academy Portal" },
      { name: "description", content: "Choose a new password for your Elevate Academy portal account." },
      { property: "og:title", content: "Set a New Password — Elevate Academy" },
      { property: "og:description", content: "Reset your Elevate Academy portal password." },
    ],
  }),
  component: ResetPassword,
});

function ResetPassword() {
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const password = String(new FormData(e.currentTarget).get("password") ?? "");
    if (password.length < 8) return toast.error("Password must be at least 8 characters");
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) return toast.error("We couldn't update your password. The link may have expired.");
    toast.success("Password updated");
    navigate({ to: "/profile" });
  };

  return (
    <section className="flex min-h-[100svh] items-center justify-center bg-navy-gradient px-4 pt-20">
      <form onSubmit={submit} className="w-full max-w-md space-y-4 rounded-3xl border bg-card p-8 shadow-lift">
        <Logo className="justify-center" />
        <h1 className="text-center text-2xl font-bold">Set a new password</h1>
        <div className="space-y-1.5">
          <Label htmlFor="password">New password</Label>
          <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        </div>
        <Button type="submit" variant="navy" className="w-full" disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />} Update password
        </Button>
      </form>
    </section>
  );
}
