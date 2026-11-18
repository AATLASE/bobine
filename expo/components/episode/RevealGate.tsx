import * as Haptics from "expo-haptics";
import { Sparkles } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn, Pulse, notify } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { hasSeenReveal, markRevealSeen } from "@/lib/revealSeen";

/** A reveal older than this is history, not news: its reviews show directly. */
const FRESH_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * The reveal as a moment. The first time somebody opens a freshly revealed
 * episode, the reviews stay behind one last card and a button: they wrote
 * without seeing the others, so reading them is theirs to start. Before this,
 * the screen simply showed the reviews, and whoever wrote last got the same
 * "Review enregistrée" toast as everybody else.
 *
 * Shown once per episode and per device. Skipped when there is nothing to
 * discover (a single review), for old reveals, and for episodes opened by
 * unlocking the season (no reveal date).
 */
export function RevealGate({
  episodeId,
  revealedAt,
  reviewCount,
  ready,
  children,
}: {
  episodeId: string;
  revealedAt: string | null | undefined;
  reviewCount: number;
  /** False while the reviews are still loading: the count is not known yet. */
  ready: boolean;
  children: React.ReactNode;
}) {
  const [state, setState] = useState<"checking" | "sealed" | "open" | "opened">("checking");

  useEffect(() => {
    if (!ready || state !== "checking") return;
    const fresh = !!revealedAt && Date.now() - Date.parse(revealedAt) < FRESH_MS;
    if (!fresh || reviewCount < 2) {
      setState("open");
      return;
    }
    let active = true;
    hasSeenReveal(episodeId).then((seen) => {
      if (active) setState(seen ? "open" : "sealed");
    });
    return () => {
      active = false;
    };
  }, [ready, state, revealedAt, reviewCount, episodeId]);

  if (state === "checking") return null;
  if (state === "open") return <>{children}</>;
  if (state === "opened") return <FadeIn duration={600}>{children}</FadeIn>;

  return (
    <FadeIn>
      <Card elevated style={{ alignItems: "center", gap: spacing.md, paddingVertical: spacing.xl, borderColor: colors.accent }}>
        <Pulse>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <Sparkles size={30} color={colors.accent} />
          </View>
        </Pulse>
        <AppText variant="title" center>
          C&apos;est révélé
        </AppText>
        <AppText variant="bodyMuted" center style={{ maxWidth: 300 }}>
          Tout le monde a écrit sans voir les autres. {reviewCount} reviews t&apos;attendent.
        </AppText>
        <Button
          title="Découvrir les reviews"
          size="lg"
          fullWidth
          onPress={() => {
            notify(Haptics.NotificationFeedbackType.Success);
            void markRevealSeen(episodeId);
            setState("opened");
          }}
        />
      </Card>
    </FadeIn>
  );
}
