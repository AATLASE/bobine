import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Clapperboard, LayoutGrid, Lock, PenLine, Plus, Rows3, Settings, Sparkles } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { RefreshControl, View, useWindowDimensions } from "react-native";
import { EpisodePoster, EpisodeRow } from "@/components/EpisodeCard";
import { NoSpaceState } from "@/components/NoSpaceState";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { AvatarStack } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen, SectionHeader } from "@/components/ui/Card";
import { EmptyState, Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale, Pulse } from "@/components/ui/motion";
import { SegmentedToggle } from "@/components/ui/SegmentedToggle";
import { AppText } from "@/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/constants/theme";
import { formatDateShort, getSeasonStatus, type SeasonStatus } from "@/lib/format";
import { canParticipate, isOwner, presentReviewers, reviewersOf, reviewProgress, type ReviewProgress } from "@/lib/types";
import { useSpaceAbsences } from "@/hooks/useAbsences";
import { useEpisodes } from "@/hooks/useEpisodes";
import { useLayout } from "@/hooks/useLayout";
import { useMembers } from "@/hooks/useMembers";
import { useSpaceReviewAuthors } from "@/hooks/useReviews";
import { useActiveSpace } from "@/providers/activeSpace";
import { useAuth } from "@/providers/auth";

type ViewMode = "grid" | "timeline";

/** Poster columns for a given grid width: two on phones, up to five on desktop. */
function columnsFor(width: number): number {
  if (width >= 1000) return 5;
  if (width >= 760) return 4;
  if (width >= 520) return 3;
  return 2;
}

const VIEW_MODES = [
  { value: "grid" as const, label: "Grille", icon: LayoutGrid, accessibilityLabel: "Affichage en grille" },
  { value: "timeline" as const, label: "Timeline", icon: Rows3, accessibilityLabel: "Affichage en timeline" },
];

/** "Saison en cours · J-12", or whatever the season is doing instead. */
function seasonLine(status: SeasonStatus): string {
  switch (status.state) {
    case "unlocked":
      return "Saison débloquée";
    case "ended":
      return "Saison terminée";
    case "upcoming":
      return status.label;
    default:
      return status.daysLeft !== null ? `Saison en cours · J-${status.daysLeft}` : "Saison en cours";
  }
}

/**
 * The reviews waiting for you, oldest first: one line at the top of the home
 * screen, because that is what makes an episode reveal for everyone.
 */
function ReviewWaitingBanner({ title, others, onPress }: { title: string; others: number; onPress: () => void }) {
  return (
    <FadeIn>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`« ${title} » attend ta review. Écrire`}
        style={{ flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary, borderRadius: radius.lg, paddingHorizontal: spacing.md, paddingVertical: spacing.md }}
      >
        <PenLine size={18} color={colors.primary} />
        <View style={{ flex: 1, gap: 2 }}>
          <AppText numberOfLines={2} style={{ fontWeight: "700", fontSize: 14.5, color: colors.text }}>
            « {title} » attend ta review
          </AppText>
          {others > 0 ? (
            <AppText variant="caption">
              et {others} autre{others > 1 ? "s" : ""} épisode{others > 1 ? "s" : ""}
            </AppText>
          ) : null}
        </View>
        <AppText style={{ color: colors.primary, fontWeight: "700", fontSize: 14 }}>Écrire ›</AppText>
      </PressableScale>
    </FadeIn>
  );
}

export default function MomentsScreen() {
  const router = useRouter();
  const { userId } = useAuth();
  const { space, isLoading, hasNoSpace, refetch, isRefetching } = useActiveSpace();
  const spaceId = space?.id ?? "";

  const { data: episodes, isLoading: episodesLoading } = useEpisodes(spaceId);
  const { data: members } = useMembers(spaceId);
  const { data: reviewAuthors } = useSpaceReviewAuthors(spaceId);
  const { data: absences } = useSpaceAbsences(spaceId);
  const [mode, setMode] = useState<ViewMode>("grid");
  const { wide, desktop } = useLayout();
  const window = useWindowDimensions();
  // Measured on layout; the first frame assumes the phone padding so phones never re-flow.
  const [gridWidth, setGridWidth] = useState<number>(window.width - spacing.lg * 2);
  const columns = columnsFor(gridWidth);
  const cardWidth = Math.floor((gridWidth - spacing.md * (columns - 1)) / columns);

  const seasonUnlocked = !!space?.season_unlocked;
  // Nothing until the authors are known: every card would say "À toi" for a beat.
  const progressById = useMemo(() => {
    if (!reviewAuthors || !absences || !episodes) return undefined;
    const reviewers = reviewersOf(members);
    // Each episode waits only for the participants who were there.
    return new Map<string, ReviewProgress>(
      episodes.map((ep) => {
        const authors = reviewAuthors.get(ep.id);
        return [ep.id, reviewProgress(ep, authors, presentReviewers(reviewers, absences.get(ep.id), authors), userId, seasonUnlocked)];
      })
    );
  }, [reviewAuthors, absences, episodes, members, userId, seasonUnlocked]);

  // Episodes come newest first, so the oldest one waiting is the last.
  const waiting = useMemo(
    () =>
      (episodes ?? []).filter((ep) => {
        const p = progressById?.get(ep.id);
        return !!p && p.myTurn && !p.revealed;
      }),
    [episodes, progressById]
  );

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Chargement…" />
      </View>
    );
  }

  if (hasNoSpace || !space) {
    return (
      <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
        <SpaceSwitcher />
        <NoSpaceState
          icon={<Sparkles size={30} color={colors.primary} />}
          title="Aucun espace pour l'instant"
          subtitle="Crée ta première aventure partagée, ou rejoins celle d'un proche avec un code d'invitation."
        />
      </Screen>
    );
  }

  const status = getSeasonStatus(space);
  const owner = isOwner(space.membership);
  const participate = canParticipate(space.membership);
  const oldestWaiting = waiting[waiting.length - 1];

  const openEpisode = (episodeId: string) => router.push({ pathname: "/episode/[episodeId]", params: { episodeId } });
  const create = () => router.push({ pathname: "/create-episode/[spaceId]", params: { spaceId } });
  const openMembers = () => router.push({ pathname: "/space-members/[spaceId]", params: { spaceId } });

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      <SpaceSwitcher />

      <View style={{ gap: spacing.md, flexDirection: desktop && space.cover_url ? "row" : "column", alignItems: desktop ? "stretch" : undefined }}>
        {/* The cover only when there is a real photo: an empty gradient pushed
            the episodes below the fold, and the name is already in the header. */}
        {space.cover_url ? (
          <FadeIn style={desktop ? { flex: 1.35 } : undefined}>
            <View style={[{ height: desktop ? "100%" : wide ? 200 : 150, minHeight: 150, borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }, shadows.poster]}>
              <Image source={{ uri: space.cover_url }} style={{ position: "absolute", width: "100%", height: "100%" }} contentFit="cover" transition={250} />
              {space.description ? (
                <>
                  <LinearGradient colors={["transparent", "rgba(8,8,9,0.85)"]} locations={[0.45, 1]} style={{ position: "absolute", width: "100%", height: "100%" }} />
                  <AppText numberOfLines={1} style={{ position: "absolute", bottom: spacing.md, left: spacing.md, right: spacing.md, color: "rgba(255,255,255,0.85)", fontSize: 13.5, fontWeight: "500" }}>
                    {space.description}
                  </AppText>
                </>
              ) : null}
            </View>
          </FadeIn>
        ) : null}

        {/* Season, group and settings in one compact band. */}
        <FadeIn delay={40} style={desktop && space.cover_url ? { flex: 1 } : undefined}>
          <Card style={{ gap: spacing.md, paddingVertical: spacing.md, flexGrow: 1, justifyContent: "center" }}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <View style={{ flex: 1, gap: 2 }}>
                <AppText style={{ fontWeight: "700", fontSize: 14.5, color: colors.text }}>{seasonLine(status)}</AppText>
                {space.season_start && space.season_end ? (
                  <AppText variant="caption">
                    {formatDateShort(space.season_start)} → {formatDateShort(space.season_end)}
                  </AppText>
                ) : null}
              </View>
              {owner ? (
                <IconButton
                  icon={<Settings size={17} color={colors.text} />}
                  onPress={() => router.push({ pathname: "/space-settings/[spaceId]", params: { spaceId } })}
                  size={36}
                  accessibilityLabel="Réglages de l'espace"
                />
              ) : null}
            </View>

            <View style={{ height: 4, backgroundColor: colors.surface, borderRadius: radius.pill, overflow: "hidden" }}>
              <LinearGradient colors={[colors.primary, colors.primaryDark]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={{ width: `${Math.max(4, status.progress * 100)}%`, height: "100%" }} />
            </View>

            <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: spacing.sm }}>
              <PressableScale
                onPress={openMembers}
                scaleTo={0.96}
                accessibilityRole="button"
                accessibilityLabel={`${members?.length ?? 0} membres. Gérer les membres`}
                style={{ flexDirection: "row", alignItems: "center", gap: 6 }}
              >
                <AvatarStack profiles={(members ?? []).map((m) => m.profile)} size={28} />
                <ChevronRight size={16} color={colors.textFaint} />
              </PressableScale>
              {status.state !== "unlocked" && status.state !== "ended" ? (
                <Button title="Aperçu du bilan ›" variant="ghost" size="sm" onPress={() => router.push("/recap")} />
              ) : null}
            </View>

            {status.state === "unlocked" ? (
              <Button title="Voir le bilan de la saison" variant="gold" icon={<Sparkles size={18} color="#1A1607" />} onPress={() => router.push("/recap")} />
            ) : status.state === "ended" ? (
              owner ? (
                <Pulse>
                  <Button title="Débloquer la saison" icon={<Lock size={18} color={colors.primaryFg} />} onPress={() => router.push("/recap")} fullWidth />
                </Pulse>
              ) : (
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, justifyContent: "center", paddingVertical: 4 }}>
                  <Lock size={15} color={colors.textMuted} />
                  <AppText variant="bodyMuted">En attente du déverrouillage par le propriétaire</AppText>
                </View>
              )
            ) : null}
          </Card>
        </FadeIn>

        {oldestWaiting && !(desktop && space.cover_url) ? (
          <ReviewWaitingBanner
            title={oldestWaiting.title}
            others={waiting.length - 1}
            onPress={() => router.push({ pathname: "/review/[episodeId]", params: { episodeId: oldestWaiting.id } })}
          />
        ) : null}
      </View>

      {/* On desktop the banner sits under the cover + season row instead of inside it. */}
      {oldestWaiting && desktop && space.cover_url ? (
        <View style={{ marginTop: spacing.md }}>
          <ReviewWaitingBanner
            title={oldestWaiting.title}
            others={waiting.length - 1}
            onPress={() => router.push({ pathname: "/review/[episodeId]", params: { episodeId: oldestWaiting.id } })}
          />
        </View>
      ) : null}

      {/* Episodes */}
      <View style={{ marginTop: spacing.xl }} onLayout={(e) => setGridWidth(e.nativeEvent.layout.width)}>
        <SectionHeader
          title={`Vos épisodes${episodes && episodes.length > 0 ? ` · ${episodes.length}` : ""}`}
          action={episodes && episodes.length > 0 ? <SegmentedToggle<ViewMode> options={VIEW_MODES} value={mode} onChange={setMode} /> : undefined}
        />

        {episodesLoading ? (
          <Loader label="Chargement des épisodes…" />
        ) : !episodes || episodes.length === 0 ? (
          <EmptyState
            icon={<Clapperboard size={30} color={colors.primary} />}
            title="Pas encore d'épisode"
            subtitle={participate ? "Immortalise votre premier moment ensemble — ajoute des photos, un lieu, des tags." : "Les épisodes apparaîtront ici dès qu'un membre en créera un."}
            actionLabel={participate ? "Créer un épisode" : undefined}
            onAction={participate ? create : undefined}
          />
        ) : mode === "grid" ? (
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}>
            {episodes.map((ep, i) => (
              <EpisodePoster key={ep.id} episode={ep} progress={progressById?.get(ep.id)} width={cardWidth} index={i} onPress={() => openEpisode(ep.id)} />
            ))}
          </View>
        ) : (
          <View style={{ gap: spacing.md, flexDirection: desktop ? "row" : "column", flexWrap: "wrap" }}>
            {episodes.map((ep, i) => (
              <View key={ep.id} style={desktop ? { width: (gridWidth - spacing.md) / 2 } : undefined}>
                <EpisodeRow episode={ep} progress={progressById?.get(ep.id)} index={i} onPress={() => openEpisode(ep.id)} />
              </View>
            ))}
          </View>
        )}

        {participate && episodes && episodes.length > 0 ? (
          <Button
            title="Nouvel épisode"
            icon={<Plus size={18} color={colors.primaryFg} />}
            onPress={create}
            style={{ marginTop: spacing.xl, alignSelf: wide ? "flex-start" : undefined }}
          />
        ) : null}
      </View>
    </Screen>
  );
}
