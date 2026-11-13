import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useRouter } from "expo-router";
import { Bell, ChevronsUpDown, Plus } from "lucide-react-native";
import React, { useState } from "react";
import { Pressable, View, type PressableStateCallbackType, type ViewStyle } from "react-native";
import { BrandMark, Wordmark } from "@/components/Brand";
import { SpacePicker, SpaceThumb } from "@/components/SpaceSwitcher";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { SIDEBAR_WIDTH } from "@/hooks/useLayout";
import { useUnreadCount } from "@/hooks/useNotifications";
import { canParticipate } from "@/lib/types";
import { useActiveSpace } from "@/providers/activeSpace";

/** react-native-web adds `hovered` to the Pressable state; the types don't know it. */
type WebPressState = PressableStateCallbackType & { hovered?: boolean };

/**
 * Side navigation for wide web screens, passed to the root Tabs as its tab bar
 * (with `tabBarPosition: "left"`). Full width with labels on desktop, icons
 * only between the tablet and desktop breakpoints.
 *
 * It takes over what the phone layout spreads around the screens: the space
 * switcher and the notification bell from the header, and a permanent
 * "Nouvel épisode" action.
 */
export function SideNav({ state, descriptors, navigation, compact }: BottomTabBarProps & { compact: boolean }) {
  const router = useRouter();
  const { space } = useActiveSpace();
  const unread = useUnreadCount();
  const [picker, setPicker] = useState<boolean>(false);
  const width = compact ? SIDEBAR_WIDTH.compact : SIDEBAR_WIDTH.full;

  const itemStyle = (active: boolean) => ({ pressed, hovered }: WebPressState): ViewStyle => ({
    flexDirection: "row",
    alignItems: "center",
    justifyContent: compact ? "center" : "flex-start",
    gap: spacing.md,
    height: 44,
    paddingHorizontal: compact ? 0 : spacing.md,
    borderRadius: radius.md,
    backgroundColor: active ? colors.primarySoft : pressed ? colors.surface : hovered ? colors.card : "transparent",
  });

  return (
    <View
      style={{
        width,
        height: "100%",
        backgroundColor: colors.bgDeep,
        borderRightWidth: 1,
        borderRightColor: colors.border,
        paddingHorizontal: compact ? spacing.md : spacing.lg,
        paddingTop: spacing.xl,
        paddingBottom: spacing.lg,
        gap: spacing.xl,
      }}
    >
      {/* Brand */}
      <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm, justifyContent: compact ? "center" : "flex-start", paddingHorizontal: compact ? 0 : spacing.xs }}>
        <BrandMark size={34} glow={false} />
        {compact ? null : <Wordmark size={22} />}
      </View>

      {/* Active space */}
      <Pressable
        onPress={() => setPicker(true)}
        accessibilityRole="button"
        accessibilityLabel={`Espace actif : ${space?.name ?? "aucun"}. Changer d'espace`}
        style={({ pressed, hovered }: WebPressState) => ({
          flexDirection: "row",
          alignItems: "center",
          justifyContent: compact ? "center" : "flex-start",
          gap: spacing.sm,
          padding: compact ? 4 : spacing.sm,
          borderRadius: radius.lg,
          borderWidth: 1,
          borderColor: hovered ? colors.borderStrong : colors.border,
          backgroundColor: pressed ? colors.surface : colors.card,
        })}
      >
        <SpaceThumb uri={space?.cover_url} size={compact ? 36 : 34} />
        {compact ? null : (
          <>
            <View style={{ flex: 1, minWidth: 0 }}>
              <AppText variant="caption">Espace</AppText>
              <AppText numberOfLines={1} style={{ fontSize: 14.5, fontWeight: "700", color: colors.text }}>
                {space?.name ?? "Aucun espace"}
              </AppText>
            </View>
            <ChevronsUpDown size={16} color={colors.textMuted} />
          </>
        )}
      </Pressable>

      {/* Destinations */}
      <View style={{ gap: 4 }} accessibilityRole="tablist">
        {state.routes.map((route, index) => {
          const { options } = descriptors[route.key];
          const label = typeof options.title === "string" ? options.title : route.name;
          const active = state.index === index;
          const color = active ? colors.primary : colors.textMuted;

          const onPress = () => {
            const event = navigation.emit({ type: "tabPress", target: route.key, canPreventDefault: true });
            if (!active && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };

          return (
            <Pressable
              key={route.key}
              onPress={onPress}
              accessibilityRole="tab"
              accessibilityState={{ selected: active }}
              accessibilityLabel={label}
              style={itemStyle(active)}
            >
              {options.tabBarIcon?.({ focused: active, color, size: 22 })}
              {compact ? null : (
                <AppText style={{ fontSize: 15, fontWeight: active ? "700" : "600", color: active ? colors.text : colors.textMuted }}>{label}</AppText>
              )}
            </Pressable>
          );
        })}

        <Pressable
          onPress={() => router.push("/notifications")}
          accessibilityRole="button"
          accessibilityLabel={unread > 0 ? `Notifications, ${unread} non lues` : "Notifications"}
          style={itemStyle(false)}
        >
          <View>
            <Bell size={20} color={colors.textMuted} />
            {unread > 0 && compact ? (
              <View style={{ position: "absolute", top: -2, right: -3, width: 9, height: 9, borderRadius: 5, backgroundColor: colors.primary, borderWidth: 1.5, borderColor: colors.bgDeep }} />
            ) : null}
          </View>
          {compact ? null : (
            <>
              <AppText style={{ flex: 1, fontSize: 15, fontWeight: "600", color: colors.textMuted }}>Notifications</AppText>
              {unread > 0 ? (
                <View style={{ minWidth: 22, height: 22, paddingHorizontal: 6, borderRadius: 11, backgroundColor: colors.primary, alignItems: "center", justifyContent: "center" }}>
                  <AppText style={{ fontSize: 12, fontWeight: "800", color: colors.primaryFg }}>{unread > 99 ? "99+" : unread}</AppText>
                </View>
              ) : null}
            </>
          )}
        </Pressable>
      </View>

      {/* Primary action, pinned to the bottom */}
      {space && canParticipate(space.membership) ? (
        <Pressable
          onPress={() => router.push({ pathname: "/create-episode/[spaceId]", params: { spaceId: space.id } })}
          accessibilityRole="button"
          accessibilityLabel="Nouvel épisode"
          style={({ pressed, hovered }: WebPressState) => ({
            marginTop: "auto",
            flexDirection: "row",
            alignItems: "center",
            justifyContent: "center",
            gap: spacing.sm,
            height: 46,
            borderRadius: compact ? radius.pill : radius.md,
            backgroundColor: pressed || hovered ? colors.primaryDark : colors.primary,
          })}
        >
          <Plus size={19} color={colors.primaryFg} />
          {compact ? null : <AppText style={{ fontSize: 15, fontWeight: "700", color: colors.primaryFg }}>Nouvel épisode</AppText>}
        </Pressable>
      ) : null}

      <SpacePicker visible={picker} onClose={() => setPicker(false)} />
    </View>
  );
}
