import { useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { ChevronRight, Clapperboard, Hourglass, Sparkles, Star, Trophy } from "lucide-react-native";
import React, { useMemo } from "react";
import { TouchableOpacity, View } from "react-native";
import { Card } from "@/components/ui/Card";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { supabase } from "@/lib/supabase";
import type { Episode } from "@/lib/types";

/**
 * Ratings of the space's reviews the reader is allowed to see. The database
 * only hands out the reviews of revealed episodes (plus the reader's own), and
 * the caller keeps the revealed ones, so nothing sealed leaks into an average.
 */
function useSpaceRatings(spaceId: string) {
  return useQuery({
    queryKey: ["spaceRatings", spaceId],
    enabled: !!spaceId,
    queryFn: async (): Promise<{ episode_id: string; rating: number }[]> => {
      const { data, error } = await supabase.from("reviews").select("episode_id, rating").eq("space_id", spaceId);
      if (error) {
        console.log("[bilan] ratings unavailable:", error.message);
        return [];
      }
      return (data ?? []) as { episode_id: string; rating: number }[];
    },
  });
}

const oneDecimal = (n: number) => n.toFixed(1).replace(".", ",");

/**
 * The season as it stands today, from what is already revealed.
 *
 * The Bilan tab used to be a padlock and a countdown for the whole season:
 * nothing to read for months. The written summary and the souvenir video still
 * wait for the end; the numbers do not have to.
 */
export function SeasonSoFar({ spaceId, episodes, unlocked }: { spaceId: string; episodes: Episode[]; unlocked: boolean }) {
  const router = useRouter();
  const { data: ratings } = useSpaceRatings(spaceId);

  const stats = useMemo(() => {
    const revealed = episodes.filter((e) => unlocked || !!e.reviews_revealed_at);
    const revealedIds = new Set(revealed.map((e) => e.id));
    const byEpisode = new Map<string, number[]>();
    for (const r of ratings ?? []) {
      // 0 is "not rated" on old reviews, never a zero.
      if (!revealedIds.has(r.episode_id) || !(r.rating > 0)) continue;
      byEpisode.set(r.episode_id, [...(byEpisode.get(r.episode_id) ?? []), r.rating]);
    }
    const avg = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / xs.length;
    const all = [...byEpisode.values()].flat();
    let best: { episode: Episode; average: number } | null = null;
    for (const episode of revealed) {
      const xs = byEpisode.get(episode.id);
      if (!xs || xs.length === 0) continue;
      const average = avg(xs);
      if (!best || average > best.average) best = { episode, average };
    }
    return {
      total: episodes.length,
      revealed: revealed.length,
      sealed: episodes.length - revealed.length,
      average: all.length ? avg(all) : null,
      best,
    };
  }, [episodes, ratings, unlocked]);

  if (stats.total === 0) {
    return (
      <Card style={{ alignItems: "center", gap: 6 }}>
        <Clapperboard size={22} color={colors.textMuted} />
        <AppText variant="h3" center>La saison commence</AppText>
        <AppText variant="bodyMuted" center>
          Dès le premier épisode révélé, tu verras ici la note du groupe et vos meilleurs moments.
        </AppText>
      </Card>
    );
  }

  return (
    <View style={{ gap: spacing.md }}>
      <AppText variant="overline">La saison jusqu&apos;ici</AppText>

      <View style={{ flexDirection: "row", gap: spacing.md }}>
        <Stat icon={<Clapperboard size={18} color={colors.primary} />} value={String(stats.total)} label={stats.total > 1 ? "Épisodes" : "Épisode"} />
        <Stat icon={<Sparkles size={18} color={colors.accent} />} value={String(stats.revealed)} label={stats.revealed > 1 ? "Révélés" : "Révélé"} />
        <Stat icon={<Star size={18} color={colors.accent} />} value={stats.average === null ? "–" : oneDecimal(stats.average)} label="Note du groupe" />
      </View>

      {stats.best ? (
        <Row
          icon={<Trophy size={18} color={colors.accent} />}
          title={stats.best.episode.title}
          caption={`Le mieux noté pour l'instant · ${oneDecimal(stats.best.average)} sur 5`}
          onPress={() => router.push({ pathname: "/episode/[episodeId]", params: { episodeId: stats.best!.episode.id } })}
        />
      ) : null}

      {stats.sealed > 0 ? (
        <Row
          icon={<Hourglass size={18} color={colors.textMuted} />}
          title={stats.sealed > 1 ? `${stats.sealed} épisodes encore scellés` : "1 épisode encore scellé"}
          caption="Ils comptent ici dès que tout le monde a écrit."
          onPress={() => router.push("/aventure")}
        />
      ) : null}
    </View>
  );
}

function Stat({ icon, value, label }: { icon: React.ReactNode; value: string; label: string }) {
  return (
    <Card style={{ flex: 1, alignItems: "center", gap: 4, paddingVertical: spacing.lg, paddingHorizontal: spacing.sm }}>
      {icon}
      <AppText style={{ fontSize: 24, fontWeight: "800", color: colors.text }}>{value}</AppText>
      <AppText variant="caption" center>{label}</AppText>
    </Card>
  );
}

function Row({ icon, title, caption, onPress }: { icon: React.ReactNode; title: string; caption: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.8} accessibilityRole="button">
      <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
        <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          {icon}
        </View>
        <View style={{ flex: 1 }}>
          <AppText style={{ fontWeight: "700", fontSize: 15, color: colors.text }} numberOfLines={1}>{title}</AppText>
          <AppText variant="caption">{caption}</AppText>
        </View>
        <ChevronRight size={18} color={colors.textMuted} />
      </Card>
    </TouchableOpacity>
  );
}
