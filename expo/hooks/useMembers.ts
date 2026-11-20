import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ensureSpaceInviteCode, regenerateSpaceInviteCode } from "@/lib/invites";
import { qk } from "@/lib/keys";
import { removeStoredFiles } from "@/lib/media";
import { getProfilesMap } from "@/lib/profiles";
import { supabase } from "@/lib/supabase";
import type { InviteCode, InviteRole, MemberRole, SpaceMember } from "@/lib/types";
import { useAuth } from "@/providers/auth";

export function useMembers(spaceId: string) {
  return useQuery({
    queryKey: qk.members(spaceId),
    enabled: !!spaceId,
    queryFn: async (): Promise<SpaceMember[]> => {
      const { data, error } = await supabase
        .from("space_members")
        .select("*")
        .eq("space_id", spaceId)
        .order("joined_at", { ascending: true });
      if (error) throw error;
      const members = (data ?? []) as SpaceMember[];
      const profiles = await getProfilesMap(members.map((m) => m.user_id));
      const roleRank: Record<MemberRole, number> = { owner: 0, member: 1, observer: 2 };
      return members
        .map((m) => ({ ...m, profile: profiles[m.user_id] ?? null }))
        .sort((a, b) => roleRank[a.role] - roleRank[b.role]);
    },
  });
}

interface UpdateMemberInput {
  spaceId: string;
  userId: string;
  patch: Partial<Pick<SpaceMember, "role" | "can_create_episodes">>;
}

export function useUpdateMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, userId, patch }: UpdateMemberInput): Promise<void> => {
      const { error } = await supabase
        .from("space_members")
        .update(patch)
        .eq("space_id", spaceId)
        .eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.members(variables.spaceId) });
      queryClient.invalidateQueries({ queryKey: qk.space(variables.spaceId) });
    },
  });
}

export function useRemoveMember() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ spaceId, userId }: { spaceId: string; userId: string }): Promise<void> => {
      const { error } = await supabase.from("space_members").delete().eq("space_id", spaceId).eq("user_id", userId);
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: qk.members(variables.spaceId) });
    },
  });
}

/** What leaving a space does (see migration 20261120100000_leave_space). */
export interface LeaveSpacePlan {
  /** 'leave': just go. 'transfer': ownership passes to heir_name. 'delete': alone, the space goes too. */
  action: "leave" | "transfer" | "delete";
  heir_name: string | null;
}

/** Asked right before the confirmation, so it describes the space as it is now. */
export async function fetchLeaveSpacePlan(spaceId: string): Promise<LeaveSpacePlan> {
  const { data, error } = await supabase.rpc("leave_space_preview", { p_space_id: spaceId });
  if (error) throw error;
  if (!data) throw new Error("Tu ne fais déjà plus partie de cette aventure.");
  return data as LeaveSpacePlan;
}

/**
 * The signed-in person leaves a space, whatever their role. The server hands
 * ownership over or deletes a space left empty, and notifies the owners and
 * participants. Files of a deleted space come back to be removed here, with
 * the token still in hand (Storage refuses deletes from SQL).
 */
export function useLeaveSpace() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (spaceId: string): Promise<LeaveSpacePlan> => {
      const { data, error } = await supabase.rpc("leave_space", { p_space_id: spaceId });
      if (error) throw error;
      const result = (data ?? {}) as LeaveSpacePlan & { files?: string[] };
      await removeStoredFiles(result.files ?? []);
      return { action: result.action, heir_name: result.heir_name ?? null };
    },
    onSuccess: (_data, spaceId) => {
      queryClient.invalidateQueries({ queryKey: qk.spaces });
      queryClient.removeQueries({ queryKey: qk.space(spaceId) });
      queryClient.removeQueries({ queryKey: qk.members(spaceId) });
      queryClient.removeQueries({ queryKey: qk.episodes(spaceId) });
      queryClient.removeQueries({ queryKey: ["membership", spaceId] });
    },
  });
}

/**
 * The space's invite code for one role. Created on first read for spaces that
 * predate this model (or whose code was never generated).
 */
export function useSpaceInviteCode(spaceId: string, role: InviteRole, enabled = true) {
  const { userId } = useAuth();
  return useQuery({
    queryKey: qk.invite(spaceId, role),
    enabled: !!spaceId && !!userId && enabled,
    queryFn: (): Promise<InviteCode> => ensureSpaceInviteCode(spaceId, userId as string, role),
  });
}

/** Rolls one of the space codes — the previous one stops working immediately. */
export function useRegenerateInviteCode(spaceId: string, role: InviteRole) {
  const { userId } = useAuth();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (): Promise<InviteCode> => regenerateSpaceInviteCode(spaceId, userId as string, role),
    onSuccess: (invite) => {
      queryClient.setQueryData(qk.invite(spaceId, role), invite);
    },
  });
}
