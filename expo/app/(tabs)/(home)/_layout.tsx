import { Stack } from "expo-router";
import React from "react";
import { colors } from "@/constants/theme";

/**
 * The Moments tab is a small stack: the list of every adventure (space) the
 * user belongs to, then the dashboard of the one they open. Keeping it inside
 * the tab keeps the tab bar visible, and tapping the tab again pops back to the
 * list.
 */
export const unstable_settings = {
  // A deep link straight to /aventure still has the list underneath it.
  initialRouteName: "index",
};

export default function HomeStackLayout() {
  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="aventure" />
    </Stack>
  );
}
