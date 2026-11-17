import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { ActivityIndicator, Platform, View } from "react-native";
import { colors } from "@/constants/theme";
import { createSessionFromUrl } from "@/lib/oauth";
import { useAuth } from "@/providers/auth";

/**
 * Landing route for the OAuth redirect (`/auth-callback` on web,
 * `rork-app://auth-callback` on native). On web the Supabase client picks the
 * session up from the URL by itself (`detectSessionInUrl`); on native we try to
 * exchange the launch URL in case the deep link reached the app instead of the
 * auth session. Either way, once the session exists we leave for the home tab.
 */
export default function AuthCallback() {
  const { isAuthenticated, initializing } = useAuth();
  const router = useRouter();
  const tried = useRef(false);

  // Native fallback: consume the code/token carried by the deep link.
  useEffect(() => {
    if (Platform.OS === "web" || tried.current) return;
    tried.current = true;
    Linking.getInitialURL()
      .then((url) => (url && url.includes("auth-callback") ? createSessionFromUrl(url) : false))
      .catch(() => false);
  }, []);

  useEffect(() => {
    if (initializing) return;
    if (isAuthenticated) {
      router.replace("/");
      return;
    }
    // No session showed up (cancelled, expired code…): back to login.
    const t = setTimeout(() => router.replace("/login"), 4000);
    return () => clearTimeout(t);
  }, [initializing, isAuthenticated, router]);

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: colors.bg }}>
      <ActivityIndicator color={colors.primary} size="large" />
    </View>
  );
}
