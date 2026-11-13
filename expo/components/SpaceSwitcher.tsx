import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { Bell, Check, ChevronDown, Film, Plus, Ticket, X } from "lucide-react-native";
import React, { useState } from "react";
import { Modal, Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Button, IconButton } from "@/components/ui/Button";
import { Divider } from "@/components/ui/Card";
import { PressableScale } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, radius, shadows, spacing } from "@/constants/theme";
import { useLayout } from "@/hooks/useLayout";
import { useUnreadCount } from "@/hooks/useNotifications";
import { useActiveSpace } from "@/providers/activeSpace";

/**
 * Header for the root tabs. With tabs at the root the active space is implicit,
 * so this is what tells you which one you are looking at — and the only way to
 * switch. It replaces the old "list of spaces" home screen.
 *
 * On wide web screens the side navigation carries the switcher and the
 * notifications, so this shrinks to a plain page title naming the space.
 */
export function SpaceSwitcher() {
  const router = useRouter();
  const { space } = useActiveSpace();
  const unread = useUnreadCount();
  const { wide } = useLayout();
  const [open, setOpen] = useState<boolean>(false);

  if (wide) {
    return (
      <View style={{ paddingTop: spacing.sm, paddingBottom: spacing.lg, gap: 2 }}>
        <AppText variant="overline">Espace</AppText>
        <AppText variant="title" numberOfLines={1}>
          {space?.name ?? "Aucun espace"}
        </AppText>
      </View>
    );
  }

  return (
    <>
      <View
        style={{
          flexDirection: "row",
          alignItems: "center",
          gap: spacing.sm,
          paddingHorizontal: spacing.lg,
          paddingTop: spacing.sm,
          paddingBottom: spacing.md,
        }}
      >
        <PressableScale
          onPress={() => setOpen(true)}
          scaleTo={0.98}
          accessibilityRole="button"
          accessibilityLabel={`Espace actif : ${space?.name ?? "aucun"}. Changer d'espace`}
          style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 6 }}
        >
          <AppText variant="h2" numberOfLines={1} style={{ flexShrink: 1 }}>
            {space?.name ?? "Aucun espace"}
          </AppText>
          <ChevronDown size={19} color={colors.textMuted} />
        </PressableScale>

        <PressableScale
          onPress={() => router.push("/notifications")}
          scaleTo={0.9}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
          style={{
            width: 44,
            height: 44,
            borderRadius: radius.pill,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Bell size={20} color={colors.text} />
          {unread > 0 ? (
            <View
              style={{
                position: "absolute",
                top: 8,
                right: 8,
                minWidth: 9,
                height: 9,
                borderRadius: 5,
                backgroundColor: colors.primary,
                borderWidth: 1.5,
                borderColor: colors.card,
              }}
            />
          ) : null}
        </PressableScale>
      </View>

      <SpacePicker visible={open} onClose={() => setOpen(false)} />
    </>
  );
}

/**
 * The list of the user's spaces, plus create / join. A bottom sheet on phones,
 * a centered dialog on wide screens.
 */
export function SpacePicker({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { wide } = useLayout();
  const { space, spaces, select } = useActiveSpace();

  const choose = (id: string) => {
    select(id);
    onClose();
  };

  const go = (path: "/create-space" | "/join") => {
    onClose();
    router.push(path);
  };

  return (
    <Modal visible={visible} animationType={wide ? "fade" : "slide"} transparent onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        accessibilityLabel="Fermer"
        style={{
          flex: 1,
          backgroundColor: colors.overlay,
          justifyContent: wide ? "center" : "flex-end",
          alignItems: wide ? "center" : "stretch",
          padding: wide ? spacing.xxl : 0,
        }}
      >
        {/* Stop propagation so taps inside the sheet don't dismiss it. */}
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={[
            {
              backgroundColor: colors.bgElevated,
              borderTopLeftRadius: radius.xxl,
              borderTopRightRadius: radius.xxl,
              paddingBottom: insets.bottom + spacing.lg,
              maxHeight: "80%",
            },
            wide
              ? {
                  width: "100%",
                  maxWidth: 480,
                  borderRadius: radius.xxl,
                  borderWidth: 1,
                  borderColor: colors.border,
                  paddingBottom: spacing.lg,
                }
              : null,
            wide ? shadows.poster : null,
          ]}
        >
          <View
            style={{
              flexDirection: "row",
              alignItems: "center",
              padding: spacing.lg,
              gap: spacing.md,
            }}
          >
            <AppText variant="h3" style={{ flex: 1 }}>
              Tes espaces
            </AppText>
            <IconButton icon={<X size={19} color={colors.text} />} onPress={onClose} size={38} accessibilityLabel="Fermer" />
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: spacing.lg, gap: spacing.sm }}>
            {spaces.map((s) => {
              const active = s.id === space?.id;
              return (
                <PressableScale
                  key={s.id}
                  onPress={() => choose(s.id)}
                  scaleTo={0.98}
                  accessibilityRole="button"
                  accessibilityLabel={`Ouvrir ${s.name}${active ? " (espace actif)" : ""}`}
                  style={{
                    flexDirection: "row",
                    alignItems: "center",
                    gap: spacing.md,
                    padding: spacing.sm,
                    borderRadius: radius.lg,
                    backgroundColor: active ? colors.primarySoft : colors.card,
                    borderWidth: 1,
                    borderColor: active ? colors.primary : colors.border,
                  }}
                >
                  <SpaceThumb uri={s.cover_url} size={46} />
                  <AppText variant="h3" numberOfLines={1} style={{ flex: 1 }}>
                    {s.name}
                  </AppText>
                  {active ? <Check size={19} color={colors.primary} /> : null}
                </PressableScale>
              );
            })}

            {spaces.length === 0 ? (
              <AppText variant="bodyMuted" center style={{ paddingVertical: spacing.lg }}>
                Tu ne fais encore partie d&apos;aucun espace.
              </AppText>
            ) : null}

            <Divider style={{ marginVertical: spacing.md }} />

            <View style={{ gap: spacing.md, flexDirection: wide ? "row" : "column" }}>
              <Button
                title="Créer un espace"
                icon={<Plus size={18} color={colors.primaryFg} />}
                onPress={() => go("/create-space")}
                style={wide ? { flex: 1 } : undefined}
              />
              <Button
                title="J'ai un code"
                variant="secondary"
                icon={<Ticket size={18} color={colors.text} />}
                onPress={() => go("/join")}
                style={wide ? { flex: 1 } : undefined}
              />
            </View>
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

/** Square space cover, or a film icon when the space has none. */
export function SpaceThumb({ uri, size }: { uri?: string | null; size: number }) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.24),
        overflow: "hidden",
        backgroundColor: colors.surface,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: "100%", height: "100%" }} contentFit="cover" transition={150} />
      ) : (
        <Film size={Math.round(size * 0.44)} color={colors.textMuted} />
      )}
    </View>
  );
}
