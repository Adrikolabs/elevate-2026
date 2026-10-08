import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter, useNavigate } from "@tanstack/react-router";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type MyStudent = {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  student_code: string | null;
  hub_id: string | null;
  hub_name: string | null;
  created_at: string;
  department_id: string | null;
  department_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  graduation_year: number;
  is_nominee: boolean;
  is_active: boolean;
  portfolio_url: string | null;
  github_url: string | null;
  behance_url: string | null;
  linkedin_url: string | null;
  has_voted: boolean;
  voted_at: string | null;
};

type AuthState = {
  ready: boolean;
  user: User | null;
  student: MyStudent | null;
  studentLoading: boolean;
  isAdmin: boolean;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const router = useRouter();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === "SIGNED_IN" || event === "SIGNED_OUT" || event === "USER_UPDATED") {
        router.invalidate();
        if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
      }
    });
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setReady(true);
    });
    return () => sub.subscription.unsubscribe();
  }, [router, queryClient]);

  const userId = session?.user.id;

  const studentQ = useQuery({
    queryKey: ["me", userId],
    enabled: !!userId,
    queryFn: async (): Promise<MyStudent | null> => {
      const { data, error } = await supabase.rpc("get_my_student");
      if (error) throw error;
      return (data?.[0] as MyStudent | undefined) ?? null;
    },
  });

  const adminQ = useQuery({
    queryKey: ["is-admin", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("has_role", { _user_id: userId!, _role: "admin" });
      if (error) return false;
      return !!data;
    },
  });

  const signOut = async () => {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/login", replace: true });
  };

  return (
    <AuthContext.Provider
      value={{
        ready,
        user: session?.user ?? null,
        student: studentQ.data ?? null,
        studentLoading: !!userId && studentQ.isLoading,
        isAdmin: !!adminQ.data,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
