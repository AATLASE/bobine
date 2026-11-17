import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { qk } from "@/lib/keys";
import { supabase } from "@/lib/supabase";

/**
 * Who was not there, for every episode of a space: episode id → user ids.
 *
 * An episode only waits for the participants who lived it. Absences are what
 * is stored (an episode with none means "everybody was there"), so the home
 * cards and the episode screen subtract them from the space's participants.
 */
export function useSpaceAbsences(spaceId: string) {
  return useQuery({
    queryKey: qk.absences(spaceId),
    enabled: !!spaceId,
    queryFn: async (): Promise<Map<string, Set<string>>> => {
      const { data, error } = await supabase.from("episode_absences").select("episode_id, user_id").eq("space_id", spaceId);
      const byEpisode = new Map<string, Set<string>>();
      // Never a reason to hide the "À toi" marks: without the list, an episode
      // simply waits for everybody, as it did before absences existed.
      if (error) {
        console.log("[absences] could not load:", error.message);
        return byEpisode;
      }
      for (const row of (data ?? []) as { episode_id: string; user_id: string }[]) {
        const set = byEpisode.get(row.episode_id) ?? new Set<string>();
        set.add(row.user_id);
        byEpisode.set(row.episode_id, set);
      }
      return byEpisode;
    },
  });
}

/** The database call behind every "absent / present" change. */
export async function setEpisodeAbsence(episodeId: string, userId: string, absent: boolean): Promise<void> {
  const { error } = await supabase.rpc("set_episode_absence", {
    p_episode_id: episodeId,
    p_user_id: userId,
    p_absent: absent,
  });
  if (error) throw error;
}

/**
 * Marks somebody absent from an episode, or present again. Yourself always;
 * somebody else when you created the episode or own the space (the database
 * checks). Marking the last awaited person absent reveals the episode, hence
 * the wide refresh.
 */
export function useSetEpisodeAbsence(episodeId: string, spaceId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, absent }: { userId: string; absent: boolean }) => setEpisodeAbsence(episodeId, userId, absent),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: qk.absences(spaceId) });
      queryClient.invalidateQueries({ queryKey: qk.episode(episodeId) });
      queryClient.invalidateQueries({ queryKey: qk.episodes(spaceId) });
      queryClient.invalidateQueries({ queryKey: qk.reviews(episodeId) });
    },
  });
}
