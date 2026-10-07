import { Link } from "@tanstack/react-router";
import { ShieldAlert } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { Button } from "@/components/ui/button";

/** Shown when a signed-in account isn't linked to an approved student record. */
export function NotRegisteredNotice() {
  const { user, isAdmin, signOut } = useAuth();
  return (
    <div className="mx-auto max-w-xl rounded-2xl border bg-card p-8 text-center shadow-soft">
      <ShieldAlert className="mx-auto h-12 w-12 text-gold" aria-hidden />
      <h2 className="mt-4 text-xl font-bold">{isAdmin ? "You're signed in as an administrator" : "Student record not found"}</h2>
      <p className="mt-2 text-sm text-muted-foreground">
        {isAdmin
          ? "Administrator accounts don't vote. Head to the admin dashboard to manage the portal."
          : `The email ${user?.email ?? ""} isn't registered as an active Elevate Academy student yet. Please contact Elevate Academy to be added.`}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        {isAdmin ? (
          <Button asChild variant="navy"><Link to="/admin">Open admin dashboard</Link></Button>
        ) : (
          <Button variant="outline" onClick={signOut}>Sign out</Button>
        )}
        <Button asChild variant="ghost"><Link to="/">Back home</Link></Button>
      </div>
    </div>
  );
}
