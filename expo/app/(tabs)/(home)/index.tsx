import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ChevronRight, Film, Plus, Sparkles, Ticket } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { RefreshControl, View, useWindowDimensions } from "react-native";
import { NoSpaceState } from "@/components/NoSpaceState";
import { NotificationBell } from "@/components/SpaceSwitcher";
import { Button } from "@/components/ui/Button";
import { Screen } from "@/components/ui/Card";
import { Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/constants/theme";
import { useLayout } from "@/hooks/useLayout";
import { formatDateShort, getSeasonStatus } from "@/lib/format";
import type { SpaceWithMembership } from "@/lib/types";
import { useActiveSpace } from "@/providers/activeSpace";

type AdventureState = "live" | "upcoming" | "done";

interface AdventureStatus {
  state: AdventureState;
  /** The word in the bubble. */
  badge: string;
  /** What the season is doing, in a few words ("12 jours restants"). */
  detail: string;
}

/** Ongoing adventures first, then the ones about to start, then the finished ones. */
const ORDER: Record<AdventureState, number> = { live: 0, upcoming: 1, done: 2 };

function adventureStatus(space: SpaceWithMembership): AdventureStatus {
  const season = getSeasonStatus(space);
  switch (season.state) {
    case "unlocked":
      return { state: "done", badge: "Terminée", detail: "Bilan débloqué" };
    case "ended":
      return { state: "done", badge: "Terminée", detail: "Bilan à débloquer" };
    case "upcoming":
      return { state: "upcoming", badge: "À venir", detail: season.label };
    default:
      return { state: "live", badge: "En cours", detail: season.label };
  }
}

const BUBBLE: Record<AdventureState, { dot: string; bg: string; fg: string }> = {
  live: { dot: "#3DD27E", bg: "rgba(10,10,12,0.62)", fg: "#FFFFFF" },
  upcoming: { dot: "#E7D46A", bg: "rgba(10,10,12,0.62)", fg: "#FFFFFF" },
  done: { dot: "rgba(255,255,255,0.55)", bg: "rgba(10,10,12,0.62)", fg: "rgba(255,255,255,0.85)" },
};

/** The little pill sitting on the cover: "En cours", "Terminée" or "À venir". */
function StatusBubble({ status }: { status: AdventureStatus }) {
  const c = BUBBLE[status.state];
  return (
    <View
      style={{
        position: "absolute",
        top: spacing.sm,
        left: spacing.sm,
        flexDirection: "row",
        alignItems: "center",
        gap: 6,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: radius.pill,
        backgroundColor: c.bg,
      }}
    >
      <View style={{ width: 7, height: 7, borderRadius: 4, backgroundColor: c.dot }} />
      <AppText style={{ fontSize: 12, fontWeight: "700", color: c.fg, letterSpacing: 0.2 }}>{status.badge}</AppText>
    </View>
  );
}

function AdventureCard({
  space,
  status,
  width,
  index,
  onPress,
}: {
  space: SpaceWithMembership;
  status: AdventureStatus;
  width: number;
  index: number;
  onPress: () => void;
}) {
  const done = status.state === "done";
  const dates =
    space.season_start && space.season_end ? `${formatDateShort(space.season_start)} → ${formatDateShort(space.season_end)}` : null;

  return (
    <FadeIn delay={Math.min(index, 8) * 50} style={{ width }}>
      <PressableScale
        onPress={onPress}
        scaleTo={0.98}
        accessibilityRole="button"
        accessibilityLabel={`${space.name}, ${status.badge}. Ouvrir l'aventure`}
        style={[
          { borderRadius: radius.xl, overflow: "hidden", backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
          shadows.card,
        ]}
      >
        <View style={{ height: 140, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}>
          {space.cover_url ? (
            <Image
              source={{ uri: space.cover_url }}
              style={{ position: "absolute", width: "100%", height: "100%", opacity: done ? 0.7 : 1 }}
              contentFit="cover"
              transition={200}
            />
          ) : (
            <>
              <LinearGradient
                colors={[colors.primarySoft, colors.surface]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ position: "absolute", width: "100%", height: "100%" }}
              />
              <Film size={30} color={colors.textMuted} />
            </>
          )}
          <StatusBubble status={status} />
        </View>

        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, padding: spacing.md }}>
          <View style={{ flex: 1, gap: 3 }}>
            <AppText variant="h3" numberOfLines={1}>
              {space.name}
            </AppText>
            {space.description ? (
              <AppText variant="bodyMuted" numberOfLines={1} style={{ fontSize: 13.5, lineHeight: 18 }}>
                {space.description}
              </AppText>
            ) : null}
            <AppText variant="caption" numberOfLines={1}>
              {dates ? `${dates} · ${status.detail}` : status.detail}
            </AppText>
          </View>
          <ChevronRight size={18} color={colors.textFaint} />
        </View>
      </PressableScale>
    </FadeIn>
  );
}

/** One column on phones, two on tablets, three on desktop. */
function columnsFor(width: number): number {
  if (width >= 900) return 3;
  if (width >= 560) return 2;
  return 1;
}

/**
 * Home of the Moments tab: every adventure (space) the user belongs to, each
 * with a bubble saying whether it is still going or finished. Opening one makes
 * it the active space and shows its episodes.
 */
export default function AdventuresScreen() {
  const router = useRouter();
  const { spaces, isLoading, hasNoSpace, select, refetch, isRefetching } = useActiveSpace();
  const { wide } = useLayout();
  const window = useWindowDimensions();
  const [listWidth, setListWidth] = useState<number>(window.width - spacing.lg * 2);
  const columns = columnsFor(listWidth);
  const cardWidth = Math.floor((listWidth - spacing.md * (columns - 1)) / columns);

  const adventures = useMemo(
    () =>
      spaces
        .map((space) => ({ space, status: adventureStatus(space) }))
        // Stable sort: inside each group the newest adventure stays first.
        .sort((a, b) => ORDER[a.status.state] - ORDER[b.status.state]),
    [spaces]
  );
  const ongoing = adventures.filter((a) => a.status.state !== "done").length;
  const finished = adventures.length - ongoing;

  const open = (id: string) => {
    select(id);
    router.push("/aventure");
  };

  if (isLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Chargement…" />
      </View>
    );
  }

  const header = (
    <View
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: spacing.sm,
        paddingTop: spacing.sm,
        paddingBottom: spacing.lg,
      }}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant={wide ? "title" : "h2"}>Nos aventures</AppText>
        {adventures.length > 0 ? (
          <AppText variant="caption">
            {[ongoing > 0 ? `${ongoing} en cours` : null, finished > 0 ? `${finished} terminée${finished > 1 ? "s" : ""}` : null]
              .filter(Boolean)
              .join(" · ")}
          </AppText>
        ) : null}
      </View>
      {/* On wide screens the side navigation already carries the bell. */}
      {wide ? null : <NotificationBell />}
    </View>
  );

  if (hasNoSpace) {
    return (
      <Screen scroll contentStyle={{ paddingHorizontal: spacing.lg }}>
        {header}
        <NoSpaceState
          icon={<Sparkles size={30} color={colors.primary} />}
          title="Aucune aventure pour l'instant"
          subtitle="Crée ta première aventure partagée, ou rejoins celle d'un proche avec un code d'invitation."
        />
      </Screen>
    );
  }

  return (
    <Screen
      scroll
      contentStyle={{ paddingHorizontal: spacing.lg }}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}
    >
      {header}

      <View
        onLayout={(e) => setListWidth(e.nativeEvent.layout.width)}
        style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.md }}
      >
        {adventures.map(({ space, status }, i) => (
          <AdventureCard key={space.id} space={space} status={status} width={cardWidth} index={i} onPress={() => open(space.id)} />
        ))}
      </View>

      <View style={{ gap: spacing.md, flexDirection: wide ? "row" : "column", marginTop: spacing.xl }}>
        <Button
          title="Nouvelle aventure"
          icon={<Plus size={18} color={colors.primaryFg} />}
          onPress={() => router.push("/create-space")}
          style={wide ? { alignSelf: "flex-start" } : undefined}
        />
        <Button
          title="J'ai un code"
          variant="secondary"
          icon={<Ticket size={18} color={colors.text} />}
          onPress={() => router.push("/join")}
          style={wide ? { alignSelf: "flex-start" } : undefined}
        />
      </View>
    </Screen>
  );
}
