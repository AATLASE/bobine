import { storage, storageKey } from "@/lib/storage";
import { BellRing } from "lucide-react-native";
import React, { useEffect, useState } from "react";
import { TouchableOpacity, View } from "react-native";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { usePushSwitch } from "@/hooks/usePushSwitch";
import { useAuth } from "@/providers/auth";

/** "Plus tard" hides the offer for this long, then it may come back. */
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const keyFor = (userId: string) => storageKey(`pushOffer.snoozed.${userId}`);

/**
 * Offers push at the one moment it answers a question the user has: their
 * review is sealed, and they are waiting for the others. Notifications were
 * only reachable from a switch at the bottom of the profile, so most people
 * never turned them on and never learned that an episode had been revealed.
 *
 * Renders nothing unless the system can still be asked: already on, refused,
 * switched off by hand, or unsupported in this browser all mean silence.
 */
export function PushOffer() {
  const { userId } = useAuth();
  const { canAsk, busy, toggle } = usePushSwitch();
  const [snoozed, setSnoozed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    storage.getItem(keyFor(userId))
      .then((raw) => {
        if (active) setSnoozed(!!raw && Date.now() - Number(raw) < SNOOZE_MS);
      })
      .catch(() => {
        if (active) setSnoozed(false);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  if (!userId || !canAsk || snoozed !== false) return null;

  const later = () => {
    setSnoozed(true);
    storage.setItem(keyFor(userId), String(Date.now())).catch(() => {});
  };

  return (
    <FadeIn>
      <Card style={{ gap: spacing.md }}>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
          <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
            <BellRing size={18} color={colors.accent} />
          </View>
          <View style={{ flex: 1 }}>
            <AppText variant="h3">Préviens-moi à la révélation</AppText>
            <AppText variant="caption">Une notification quand tout le monde a écrit, sans avoir à revenir vérifier.</AppText>
          </View>
        </View>
        <Button title="Activer les notifications" loading={busy} onPress={() => void toggle(true)} fullWidth />
        <TouchableOpacity onPress={later} hitSlop={8} style={{ alignSelf: "center" }} accessibilityRole="button">
          <AppText style={{ color: colors.textMuted, fontWeight: "600", fontSize: 13.5 }}>Plus tard</AppText>
        </TouchableOpacity>
      </Card>
    </FadeIn>
  );
}
