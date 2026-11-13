import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { useLayout } from "@/hooks/useLayout";

/** Form column width on wide screens: comfortable for one field per line. */
const FORM_WIDTH = 420;

/**
 * Frame of the sign-in, sign-up and password screens.
 *
 * Phones: the form fills the screen over the brand glow. Wide web screens: the
 * form sits in a centered column of fixed width; from the desktop breakpoint a
 * photo panel takes the right half, echoing the public landing page.
 */
export function AuthScaffold({ children }: { children: React.ReactNode }) {
  const { wide, desktop } = useLayout();

  if (wide) {
    return (
      <View style={{ flex: 1, flexDirection: "row", backgroundColor: colors.bgDeep }}>
        <StatusBar style="light" />
        <View style={{ flex: 1 }}>
          <LinearGradient
            colors={[colors.brandGlow, colors.bg, colors.bgDeep]}
            locations={[0, 0.45, 1]}
            style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
          />
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", alignItems: "center", paddingHorizontal: spacing.xxxl, paddingVertical: spacing.xxxl }}
            keyboardShouldPersistTaps="handled"
          >
            <View style={{ width: "100%", maxWidth: FORM_WIDTH }}>{children}</View>
          </ScrollView>
        </View>
        {desktop ? <AuthPhoto /> : null}
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.bgDeep }}>
      <StatusBar style="light" />
      <LinearGradient
        colors={[colors.brandGlow, colors.bg, colors.bgDeep]}
        locations={[0, 0.45, 1]}
        style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
          <ScrollView
            contentContainerStyle={{ flexGrow: 1, justifyContent: "center", padding: spacing.xl }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

/**
 * Right half of the desktop sign-in screens: a group of friends laughing, with
 * an episode caption like the polaroids of the landing page. Web only (the
 * photo is served from /public/landing).
 */
function AuthPhoto() {
  return (
    <View style={{ flex: 1.1, padding: spacing.lg }}>
      <View style={{ flex: 1, borderRadius: radius.xxl, overflow: "hidden", backgroundColor: colors.card }}>
        <Image
          source={{ uri: "/landing/hero-rooftop.webp" }}
          style={{ position: "absolute", width: "100%", height: "100%" }}
          contentFit="cover"
          contentPosition="center"
          transition={300}
          accessibilityLabel="Une bande d'amis fait un selfie sur un toit, tout le monde éclate de rire"
        />
        <LinearGradient
          colors={["rgba(8,8,9,0)", "rgba(8,8,9,0.82)"]}
          locations={[0.5, 1]}
          style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
        />
        <View style={{ position: "absolute", left: spacing.xxxl, right: spacing.xxxl, bottom: spacing.xxxl, gap: spacing.md }}>
          <View style={{ alignSelf: "flex-start", paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm, backgroundColor: colors.primary }}>
            <AppText style={{ color: colors.white, fontWeight: "800", fontSize: 13, letterSpacing: 0.4 }}>S2 · É7</AppText>
          </View>
          <AppText style={{ color: colors.white, fontSize: 34, lineHeight: 38, fontWeight: "800", letterSpacing: -0.8, maxWidth: 520 }}>
            Vos sorties méritent leur propre série.
          </AppText>
          <AppText style={{ color: "rgba(255,255,255,0.78)", fontSize: 16, lineHeight: 23, maxWidth: 460 }}>
            Chaque moment devient un épisode, chacun écrit son avis en secret, et tout se révèle d&apos;un coup.
          </AppText>
        </View>
      </View>
    </View>
  );
}
