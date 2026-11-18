import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface InvitePreview {
  spaceName: string;
  spaceType: string;
  role: "member" | "observer";
  inviterName: string | null;
  memberCount: number;
}

/**
 * What an invite code leads to, readable before signing in: the space, who
 * invites, and the role the code gives. `null` when the code is unknown.
 *
 * Never blocks the way in: if the preview cannot be read (offline, older
 * database), the welcome screen falls back to a generic invitation.
 */
export function useInvitePreview(code: string | null | undefined) {
  const clean = (code ?? "").trim().toUpperCase();
  return useQuery({
    queryKey: ["invitePreview", clean],
    enabled: clean.length > 0,
    retry: false,
    staleTime: 5 * 60 * 1000,
    queryFn: async (): Promise<InvitePreview | null | "unknown"> => {
      const { data, error } = await supabase.rpc("invite_preview", { p_code: clean });
      if (error) {
        console.log("[invite] preview unavailable:", error.message);
        return "unknown";
      }
      const row = (Array.isArray(data) ? data[0] : data) as
        | { space_name: string; space_type: string; role: string; inviter_name: string | null; member_count: number }
        | undefined;
      if (!row) return null;
      return {
        spaceName: row.space_name,
        spaceType: row.space_type,
        role: row.role === "member" ? "member" : "observer",
        inviterName: row.inviter_name?.trim() || null,
        memberCount: row.member_count ?? 0,
      };
    },
  });
}
