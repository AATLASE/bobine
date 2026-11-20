import { useRouter } from "expo-router";
import { LogOut } from "lucide-react-native";
import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { Card, SectionHeader } from "@/components/ui/Card";
import { AppText } from "@/components/ui/Text";
import { colors, spacing } from "@/constants/theme";
import { confirmAction } from "@/lib/confirm";
import { friendlyError } from "@/lib/errors";
import { fetchLeaveSpacePlan, useLeaveSpace, type LeaveSpacePlan } from "@/hooks/useMembers";
import { useToast } from "@/providers/toast";

function confirmText(plan: LeaveSpacePlan, spaceName: string): { title: string; message: string; label: string } {
  if (plan.action === "delete") {
    return {
      title: `Quitter « ${spaceName} » ?`,
      message:
        "Personne d'autre n'est dans l'aventure : elle sera supprimée avec tous ses épisodes, reviews et médias. Cette action est irréversible.",
      label: "Quitter et supprimer",
    };
  }
  const handover =
    plan.action === "transfer" && plan.heir_name ? ` ${plan.heir_name} deviendra propriétaire de l'aventure.` : "";
  return {
    title: `Quitter « ${spaceName} » ?`,
    message: `Tu n'auras plus accès à l'aventure. Tes épisodes, photos et reviews restent pour les autres.${handover} Le propriétaire et les participants seront prévenus.`,
    label: "Quitter",
  };
}

/** « Quitter l'aventure », for everyone in the space whatever their role. */
export function LeaveSpaceCard({ spaceId, spaceName }: { spaceId: string; spaceName: string }) {
  const router = useRouter();
  const toast = useToast();
  const leave = useLeaveSpace();
  const [checking, setChecking] = useState<boolean>(false);

  const onPress = async () => {
    let plan: LeaveSpacePlan;
    setChecking(true);
    try {
      plan = await fetchLeaveSpacePlan(spaceId);
    } catch (e) {
      toast.error(friendlyError(e));
      return;
    } finally {
      setChecking(false);
    }

    const { title, message, label } = confirmText(plan, spaceName);
    confirmAction(title, message, label, () =>
      leave.mutate(spaceId, {
        onSuccess: (result) => {
          toast.success(result.action === "delete" ? "Aventure supprimée" : `Tu as quitté « ${spaceName} »`);
          router.replace("/");
        },
        onError: (e) => toast.error(friendlyError(e)),
      })
    );
  };

  return (
    <>
      <SectionHeader title="Quitter l'aventure" />
      <Card style={{ borderColor: colors.destructiveSoft, gap: spacing.md }}>
        <AppText variant="bodyMuted">
          Tu n&apos;y auras plus accès. Ce que tu as partagé reste pour les autres, et le propriétaire est prévenu.
        </AppText>
        <Button
          title="Quitter l'aventure"
          variant="destructive"
          icon={<LogOut size={17} color="#fff" />}
          onPress={onPress}
          loading={checking || leave.isPending}
        />
      </Card>
    </>
  );
}
