import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { cookies } from "next/headers";

export type AuthAppUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
  role: "admin" | "user" | null;
};

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

export async function createServerSupabase() {
  const cookieStore = await cookies();
  return createServerClient(requiredEnv("NEXT_PUBLIC_SUPABASE_URL"), requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        cookieStore.set({ name, value, ...options });
      },
      remove(name: string, options: CookieOptions) {
        cookieStore.set({ name, value: "", ...options, maxAge: 0 });
      },
    },
  });
}

function resolveRole(user: User): "admin" | "user" | null {
  const role = user.app_metadata?.role;
  if (role === "admin" || role === "user") return role;
  return null;
}

function fallbackName(email: string): string {
  return email;
}

export async function getCurrentAuthAppUser(): Promise<AuthAppUser | null> {
  const supabase = await createServerSupabase();
  const { data: authData, error: authError } = await supabase.auth.getUser();
  const email = authData.user?.email ?? null;
  if (authError || !authData.user || !email) return null;

  const user = authData.user;
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, avatar_url")
    .eq("id", user.id)
    .maybeSingle();

  const fullName = profile?.full_name?.trim() || fallbackName(email);

  return {
    id: user.id,
    email,
    fullName,
    avatarUrl: profile?.avatar_url?.trim() || null,
    role: resolveRole(user),
  };
}
