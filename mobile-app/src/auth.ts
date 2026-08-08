import { Session } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface Profile {
  id: string;
  display_name: string;
  role: "staff" | "partner";
  partner_id: number | null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return error.message;
  return null;
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

export function getSession(): Promise<Session | null> {
  return supabase.auth.getSession().then(({ data }) => data.session);
}

export function onAuthChange(fn: (session: Session | null) => void): () => void {
  const { data } = supabase.auth.onAuthStateChange((_event, session) => fn(session));
  return () => data.subscription.unsubscribe();
}

export async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select("*").eq("id", userId).single();
  if (error || !data) return null;
  return data as Profile;
}
