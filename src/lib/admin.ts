import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type AdminStudent = {
  id: string;
  student_code: string | null;
  full_name: string;
  email: string;
  phone: string | null;
  department_id: string | null;
  avatar_url: string | null;
  bio: string | null;
  graduation_year: number;
  is_nominee: boolean;
  is_active: boolean;
  is_demo: boolean;
  account_linked: boolean;
  has_voted: boolean;
  votes_received: number;
  created_at: string;
};

export const adminStudentsQuery = queryOptions({
  queryKey: ["admin", "students"],
  queryFn: async (): Promise<AdminStudent[]> => {
    const { data, error } = await supabase.rpc("admin_list_students");
    if (error) throw error;
    return data as AdminStudent[];
  },
});

export const adminCountsQuery = queryOptions({
  queryKey: ["admin", "counts"],
  queryFn: async () => {
    const [votes, projects, messages] = await Promise.all([
      supabase.from("votes").select("id, department_id, created_at"),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase.from("graduation_messages").select("id", { count: "exact", head: true }),
    ]);
    if (votes.error) throw votes.error;
    return {
      votes: votes.data ?? [],
      projects: projects.count ?? 0,
      messages: messages.count ?? 0,
    };
  },
});

/** Records an administrator action. RLS only accepts rows from admins, stamped with their own id. */
export async function logAdminAction(action: string, entityType: string, entityId: string | null, description: string) {
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    admin_id: data.user.id,
    action,
    entity_type: entityType,
    entity_id: entityId,
    description,
  });
}
