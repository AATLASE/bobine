import { Tabs } from "expo-router";
import { Clapperboard, Lightbulb, Sparkles, User } from "lucide-react-native";
import React from "react";
import { Platform, View } from "react-native";
import Landing from "@/components/landing/Landing";
import { colors } from "@/constants/theme";
import { useAuth } from "@/providers/auth";

/**
 * Root tab bar. It used to live under /space/[id], which meant it appeared only
 * once you were two levels deep, disappeared when you backed out, and carried an
 * "Accueil" tab that was not the app's home. At the root it is permanent, and
 * the active space is chosen from the header instead of the URL.
 *
 * Four destinations: Membres moved into the space settings (secondary
 * navigation), and the old dashboard merged into Moments.
 *
 * On the web, a signed-out visitor at "/" gets the public landing page here
 * instead (the root auth gate leaves "/" alone for them). Nothing renders while
 * the session resolves, so members never download the landing behind the splash.
 */
export default function RootTabsLayout() {
  const { isAuthenticated, initializing } = useAuth();

  if (Platform.OS === "web" && !isAuthenticated) {
    return initializing ? <View style={{ flex: 1, backgroundColor: colors.bg }} /> : <Landing />;
  }

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: {
          backgroundColor: colors.bgDeep,
          borderTopColor: colors.border,
          borderTopWidth: 1,
          height: Platform.OS === "ios" ? 88 : 64,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontSize: 10.5, fontWeight: "600", letterSpacing: 0.1 },
        tabBarItemStyle: { paddingTop: 2 },
        sceneStyle: { backgroundColor: colors.bg },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Moments",
          tabBarIcon: ({ color, size }) => <Clapperboard size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="ideas"
        options={{
          title: "Idées",
          tabBarIcon: ({ color, size }) => <Lightbulb size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="recap"
        options={{
          title: "Bilan",
          tabBarIcon: ({ color, size }) => <Sparkles size={size - 2} color={color} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: "Profil",
          tabBarIcon: ({ color, size }) => <User size={size - 2} color={color} />,
        }}
      />
    </Tabs>
  );
}
