import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React from "react";
import { StatusBar } from "expo-status-bar";
import { Platform, Pressable, ScrollView, StyleProp, View, ViewProps, ViewStyle } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, currentScheme, radius, shadows, spacing } from "@/constants/theme";
import { CONTENT_WIDTH, useLayout } from "@/hooks/useLayout";
import { AppText } from "./Text";

interface CardProps extends ViewProps {
  elevated?: boolean;
  padded?: boolean;
  glow?: boolean;
  style?: StyleProp<ViewStyle>;
  children: React.ReactNode;
}

export function Card({ elevated, padded = true, glow, style, children, ...rest }: CardProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: elevated ? colors.cardElevated : colors.card,
          borderRadius: radius.xl,
          borderWidth: 1,
          borderColor: glow ? colors.primary : colors.border,
          padding: padded ? spacing.lg : 0,
        },
        glow ? shadows.glow : shadows.card,
        style,
      ]}
    >
      {children}
    </View>
  );
}

/**
 * Full-screen container with the deep cinematic gradient backdrop + safe areas.
 *
 * On wide web screens the content becomes a centered column (`width` picks how
 * wide), and a `dialog` screen (a modal route: create a space, write a review…)
 * becomes a panel over a dimmed backdrop, closed by clicking outside or Escape.
 * The root stack presents those routes as transparent modals on wide screens
 * so the page underneath stays visible.
 */
export function Screen({
  children,
  scroll = false,
  contentStyle,
  edges = ["top"],
  refreshControl,
  width = "page",
  dialog = false,
  onDismiss,
}: {
  children: React.ReactNode;
  scroll?: boolean;
  contentStyle?: StyleProp<ViewStyle>;
  edges?: ("top" | "bottom" | "left" | "right")[];
  refreshControl?: React.ComponentProps<typeof ScrollView>["refreshControl"];
  width?: "page" | "reading";
  dialog?: boolean;
  /** Dialog only: what clicking outside / Escape does. Defaults to going back. */
  onDismiss?: () => void;
}) {
  const { wide } = useLayout();

  if (wide && dialog) {
    return (
      <DialogFrame onDismiss={onDismiss}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[{ paddingBottom: spacing.xxl, paddingTop: spacing.lg }, contentStyle, { paddingHorizontal: spacing.xxl }]}
          keyboardShouldPersistTaps="handled"
        >
          {children}
        </ScrollView>
      </DialogFrame>
    );
  }

  // Centered column: the screen's own horizontal padding is replaced by a roomier one.
  const column: StyleProp<ViewStyle> = wide
    ? { width: "100%", maxWidth: CONTENT_WIDTH[width], alignSelf: "center", paddingHorizontal: spacing.xxxl, paddingTop: spacing.xl }
    : null;

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      <StatusBar style={currentScheme() === "dark" ? "light" : "dark"} />
      <LinearGradient
        colors={[colors.bgDeep, colors.bg, colors.bg]}
        locations={[0, 0.4, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }} edges={edges}>
        {scroll ? (
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[{ paddingBottom: spacing.xxxl }, contentStyle, column]}
            keyboardShouldPersistTaps="handled"
            automaticallyAdjustKeyboardInsets
            refreshControl={refreshControl}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[{ flex: 1 }, contentStyle, column]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/**
 * Centered panel over a dimmed backdrop, for modal routes on wide web screens.
 * Clicking the backdrop or pressing Escape goes back.
 */
export function DialogFrame({
  children,
  maxWidth = CONTENT_WIDTH.dialog,
  onDismiss,
}: {
  children: React.ReactNode;
  maxWidth?: number;
  onDismiss?: () => void;
}) {
  const router = useRouter();

  const close = React.useCallback(() => {
    if (onDismiss) onDismiss();
    else if (router.canGoBack()) router.back();
    else router.replace("/");
  }, [router, onDismiss]);

  React.useEffect(() => {
    if (Platform.OS !== "web" || typeof window === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", padding: spacing.xxl }}>
      <Pressable
        onPress={close}
        accessibilityRole="button"
        accessibilityLabel="Fermer"
        style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.overlay }}
      />
      <View
        style={[
          {
            width: "100%",
            maxWidth,
            maxHeight: "100%",
            borderRadius: radius.xxl,
            overflow: "hidden",
            backgroundColor: colors.bg,
            borderWidth: 1,
            borderColor: colors.border,
          },
          shadows.poster,
        ]}
      >
        {children}
      </View>
    </View>
  );
}

export function Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: colors.border }, style]} />;
}

/**
 * `subtitle` is how the product's series metaphor stays readable: every invented
 * word (espace, épisode, saison…) gets a plain-language gloss right under it, so
 * nobody has to have watched the onboarding to know what a section holds.
 */
export function SectionHeader({
  title,
  subtitle,
  action,
  style,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={[
        { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: spacing.md },
        style,
      ]}
    >
      <View style={{ flex: 1, gap: 2 }}>
        <AppText variant="overline">{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
      </View>
      {action}
    </View>
  );
}

/** Convenience hook re-export so screens can pad around the home indicator. */
export { useSafeAreaInsets };
