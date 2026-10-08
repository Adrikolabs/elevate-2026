import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const input = z.object({
  email: z.string().trim().toLowerCase().email().max(255),
  studentId: z.string().trim().min(1).max(40),
  origin: z.string().url().max(200),
});

export type ActivationResult = { status: "sent" | "not_registered" | "inactive" | "already_active" | "error" };

/**
 * First-time activation: only an email + student ID pair that exists in the admin roster
 * gets an activation email (the student then creates their own password). Public sign-up is disabled.
 */
export const requestActivation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => input.parse(data))
  .handler(async ({ data }): Promise<ActivationResult> => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: rows, error } = await supabaseAdmin.rpc("roster_lookup", { _email: data.email, _student_code: data.studentId });
    if (error) {
      console.error("roster_lookup failed", error.message);
      return { status: "error" };
    }
    const row = rows?.[0];
    if (!row) return { status: "not_registered" };
    if (!row.is_active) return { status: "inactive" };
    if (row.account_linked) return { status: "already_active" };

    const redirectTo = `${new URL(data.origin).origin}/reset-password`;
    const invite = await supabaseAdmin.auth.admin.inviteUserByEmail(data.email, { redirectTo });
    if (!invite.error) return { status: "sent" };

    // An unconfirmed login may already exist for this email: send a set-password link instead.
    if (/already|registered|exists/i.test(invite.error.message)) {
      const reset = await supabaseAdmin.auth.resetPasswordForEmail(data.email, { redirectTo });
      if (!reset.error) return { status: "sent" };
      console.error("activation reset failed", reset.error.message);
      return { status: "error" };
    }
    console.error("activation invite failed", invite.error.message);
    return { status: "error" };
  });
