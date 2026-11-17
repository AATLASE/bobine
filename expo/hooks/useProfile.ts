import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { removeStoredFiles } from "@/lib/media";
import { supabase } from "@/lib/supabase";
import type { Profile, Synthese } from "@/lib/types";
import { useAuth } from "@/providers/auth";

interface ProfilePatch {
  name?: string;
  avatar_url?: string | null;
  bio?: string | null;
  daily_prompt_enabled?: boolean;
}

export function useUpdateProfile() {
  const { userId, refetchProfile } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (patch: ProfilePatch): Promise<Profile> => {
      const { data, error } = await supabase
        .from("profiles")
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq("id", userId as string)
        .select("*")
        .single();
      if (error) throw error;
      return data as Profile;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile", userId] });
      refetchProfile();
    },
  });
}

/** Latest season synthèse (AI summary + memory video) for a space, if generated. */
export function useSynthese(spaceId: string, enabled = true) {
  return useQuery({
    queryKey: qk.synthese(spaceId),
    enabled: !!spaceId && enabled,
    queryFn: async (): Promise<Synthese | null> => {
      const { data, error } = await supabase
        .from("synthese")
        .select("*")
        .eq("space_id", spaceId)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) {
        // Tolerate schemas without created_at ordering / empty tables.
        return null;
      }
      return (data as Synthese | null) ?? null;
    },
  });
}

/** What deleting the account does to each space the person owns. */
export interface AccountDeletionStep {
  space_name: string;
  action: "delete" | "transfer";
  heir_name: string | null;
}

/** Read-only: feeds the confirmation dialog before anything is deleted. */
export async function fetchAccountDeletionPreview(): Promise<AccountDeletionStep[]> {
  const { data, error } = await supabase.rpc("account_deletion_preview");
  if (error) throw error;
  return (data ?? []) as AccountDeletionStep[];
}

/**
 * Deletes the signed-in account (see migration 20261117130000_delete_account).
 * The server cannot remove files: it returns them, and they go through the
 * Storage API with the token that is still in hand. Then the local session is
 * dropped; the server side of it is already gone.
 */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<void> => {
      const { data, error } = await supabase.rpc("delete_my_account");
      if (error) throw error;
      await removeStoredFiles((data as { files?: string[] } | null)?.files ?? []);
      try {
        await supabase.auth.signOut({ scope: "local" });
      } catch {
        // The session no longer exists on the server; local sign-out is all that is left.
      }
      queryClient.clear();
    },
  });
}
