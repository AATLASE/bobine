import { useRouter } from "expo-router";
import { Lock, PenLine, Sparkles } from "lucide-react-native";
import React from "react";
import { ActivityIndicator, TouchableOpacity, View } from "react-native";
import { AuthScaffold } from "@/components/AuthScaffold";
import { BrandMark } from "@/components/Brand";
import { SocialAuthButtons } from "@/components/SocialAuthButtons";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { FadeIn } from "@/components/ui/motion";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { useInvitePreview } from "@/hooks/useInvitePreview";

/**
 * Where an invite link lands for somebody who is not signed in.
 *
 * It used to be the bare login form, with "Créer un compte" below the fold and
 * not a word about the space. A guest now reads who invites them and to what,
 * what the app is in three lines, and has one obvious button.
 */
export function InviteWelcome({ code }: { code: string }) {
  const router = useRouter();
  const { data, isLoading } = useInvitePreview(code);
  const preview = data && data !== "unknown" ? data : null;
  const invalid = data === null;

  const title = preview
    ? preview.inviterName
      ? `${preview.inviterName} t'invite dans « ${preview.spaceName} »`
      : `Tu es invité·e dans « ${preview.spaceName} »`
    : invalid
      ? "Cette invitation n'est plus valide"
      : "Tu es invité·e sur Bobine";

  const subtitle = preview
    ? preview.role === "member"
      ? "Tu y participes : tu racontes les moments vécus ensemble, comme les autres."
      : "Tu suis l'aventure : les épisodes, les photos et les reviews une fois révélées."
    : invalid
      ? "Le code a peut-être changé. Demande un nouveau lien à la personne qui t'a invité·e. Tu peux quand même créer ton compte."
      : "Une bande privée t'attend, pour garder et revivre vos moments ensemble.";

  return (
    <AuthScaffold>
      <FadeIn>
        <View style={{ alignItems: "center", gap: spacing.md, marginBottom: spacing.xl }}>
          <BrandMark size={64} />
          {isLoading ? (
            <ActivityIndicator color={colors.primary} style={{ marginVertical: spacing.lg }} />
          ) : (
            <>
              <AppText variant="title" center style={{ maxWidth: 340 }}>
                {title}
              </AppText>
              <AppText variant="bodyMuted" center style={{ maxWidth: 320 }}>
                {subtitle}
              </AppText>
              {preview && preview.memberCount > 0 ? (
                <AppText style={{ color: colors.accent, fontWeight: "700", fontSize: 13.5 }}>
                  {preview.memberCount === 1 ? "1 personne t'y attend" : `${preview.memberCount} personnes t'y attendent`}
                </AppText>
              ) : null}
            </>
          )}
        </View>
      </FadeIn>

      <FadeIn delay={120}>
        <Card elevated style={{ gap: spacing.lg }}>
          <View style={{ gap: spacing.md }}>
            <Point icon={<Sparkles size={18} color={colors.primary} />} text="Chaque sortie devient un épisode, avec ses photos." />
            <Point icon={<PenLine size={18} color={colors.primary} />} text="Chacun écrit sa review de son côté, en secret." />
            <Point icon={<Lock size={18} color={colors.primary} />} text="Tout se révèle d'un coup, quand tout le monde a écrit." />
          </View>

          <Button
            title={preview ? "Créer mon compte et rejoindre" : "Créer mon compte"}
            size="lg"
            fullWidth
            onPress={() => router.push({ pathname: "/signup", params: invalid ? {} : { code } })}
          />

          <SocialAuthButtons inviteCode={invalid ? undefined : code} />
        </Card>
      </FadeIn>

      <FadeIn delay={200}>
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6, marginTop: spacing.xl }}>
          <AppText variant="bodyMuted">Déjà un compte ?</AppText>
          <TouchableOpacity onPress={() => router.push("/login")} hitSlop={8}>
            <AppText style={{ color: colors.primaryText, fontWeight: "700" }}>Se connecter</AppText>
          </TouchableOpacity>
        </View>
      </FadeIn>
    </AuthScaffold>
  );
}

function Point({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
      <View style={{ width: 34, height: 34, borderRadius: 17, backgroundColor: colors.primarySoft, alignItems: "center", justifyContent: "center" }}>
        {icon}
      </View>
      <AppText style={{ flex: 1, fontSize: 14.5, lineHeight: 20 }}>{text}</AppText>
    </View>
  );
}
