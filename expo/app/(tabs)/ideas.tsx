import { useRouter } from "expo-router";
import { Check, ChevronRight, Clapperboard, Flame, Lightbulb, Plus, Trash2, X } from "lucide-react-native";
import React, { useMemo, useState } from "react";
import { RefreshControl, TouchableOpacity, View } from "react-native";
import { SpaceSwitcher } from "@/components/SpaceSwitcher";
import { Avatar } from "@/components/ui/Avatar";
import { Button, IconButton } from "@/components/ui/Button";
import { Card, Screen, SectionHeader } from "@/components/ui/Card";
import { NoSpaceState } from "@/components/NoSpaceState";
import { EmptyState, Loader } from "@/components/ui/Feedback";
import { FadeIn, PressableScale } from "@/components/ui/motion";
import { Field, Input } from "@/components/ui/Input";
import { AppText } from "@/components/ui/Text";
import { colors, radius, spacing } from "@/constants/theme";
import { confirmAction } from "@/lib/confirm";
import { friendlyError } from "@/lib/errors";
import { formatRelative } from "@/lib/format";
import { canParticipate, isOwner } from "@/lib/types";
import { useCreateIdea, useDeleteIdea, useIdeas, useToggleIdeaVote } from "@/hooks/useSocial";
import { useActiveSpace } from "@/providers/activeSpace";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

export default function IdeasScreen() {
  const router = useRouter();
  const toast = useToast();
  const { userId } = useAuth();
  const { space, isLoading: spaceLoading, hasNoSpace } = useActiveSpace();
  const spaceId = space?.id ?? "";

  const { data: ideas, isLoading, refetch, isRefetching } = useIdeas(spaceId);
  const createIdea = useCreateIdea(spaceId);
  const toggleVote = useToggleIdeaVote(spaceId);
  const deleteIdea = useDeleteIdea(spaceId);

  const participate = canParticipate(space?.membership);
  const owner = isOwner(space?.membership);

  const [composing, setComposing] = useState<boolean>(false);
  const [title, setTitle] = useState<string>("");
  const [titleError, setTitleError] = useState<string | null>(null);
  const [description, setDescription] = useState<string>("");
  const [saving, setSaving] = useState<boolean>(false);

  // Ideas still in the vote, most wanted first; the ones the group did are
  // kept below, as the list of what came out of this tab.
  const sorted = useMemo(
    () =>
      (ideas ?? [])
        .filter((i) => i.status !== "done")
        .sort((a, b) => b.voteCount - a.voteCount || (b.created_at ?? "").localeCompare(a.created_at ?? "")),
    [ideas]
  );
  const done = useMemo(() => (ideas ?? []).filter((i) => i.status === "done"), [ideas]);

  const submit = async () => {
    if (!title.trim()) {
      setTitleError("Donne un titre à ton idée.");
      return;
    }
    setTitleError(null);
    setSaving(true);
    try {
      await createIdea.mutateAsync({ title, description });
      setTitle("");
      setDescription("");
      setComposing(false);
      toast.success("Idée proposée 💡");
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setSaving(false);
    }
  };

  if (spaceLoading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        <Loader label="Chargement…" />
      </View>
    );
  }

  if (hasNoSpace || !space) {
    return (
      <Screen scroll width="reading" contentStyle={{ paddingHorizontal: spacing.lg }}>
        <SpaceSwitcher />
        <NoSpaceState
          icon={<Lightbulb size={30} color={colors.primary} />}
          title="Aucune bande"
          subtitle="Rejoins ou crée une bande pour proposer des idées de sorties."
        />
      </Screen>
    );
  }

  return (
    <Screen scroll width="reading" contentStyle={{ paddingHorizontal: spacing.lg }} refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={colors.primary} />}>
      <SpaceSwitcher />

      <SectionHeader
        title="Idées"
        subtitle="Vos prochaines sorties, votées ensemble"
        action={
          participate ? (
            <IconButton
              icon={composing ? <X size={22} color={colors.text} /> : <Plus size={22} color={colors.primaryFg} />}
              variant={composing ? "secondary" : "primary"}
              onPress={() => setComposing((v) => !v)}
              accessibilityLabel={composing ? "Annuler la proposition" : "Proposer une idée"}
            />
          ) : undefined
        }
      />

      {composing ? (
        <FadeIn>
          <Card elevated style={{ gap: spacing.md, marginBottom: spacing.xl }}>
            <Field label="Ton idée" error={titleError}>
              <Input
                placeholder="Escape game ce week-end ?"
                value={title}
                onChangeText={(t) => {
                  setTitle(t);
                  if (titleError) setTitleError(null);
                }}
                invalid={!!titleError}
                autoFocus
              />
            </Field>
            <Field label="Détails (optionnel)">
              <Input placeholder="On peut réserver pour samedi soir…" value={description} onChangeText={setDescription} multiline />
            </Field>
            <Button title="Proposer au groupe" onPress={submit} loading={saving} />
          </Card>
        </FadeIn>
      ) : null}

      {isLoading ? (
        <Loader label="Chargement des idées…" />
      ) : sorted.length === 0 && done.length === 0 ? (
        <EmptyState
          icon={<Lightbulb size={30} color={colors.primary} />}
          title="Aucune idée pour l'instant"
          subtitle={participate ? "Lance la première idée de sortie et laisse le groupe voter." : "Les idées proposées apparaîtront ici."}
          actionLabel={participate ? "Proposer une idée" : undefined}
          onAction={participate ? () => setComposing(true) : undefined}
        />
      ) : (
        <View style={{ gap: spacing.md }}>
          {sorted.map((idea, i) => {
            const canDelete = owner || idea.proposed_by === userId;
            return (
              <FadeIn key={idea.id} delay={Math.min(i, 8) * 50}>
                <Card style={{ gap: spacing.md }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", gap: spacing.md }}>
                    <View style={{ flex: 1, gap: 4 }}>
                      <AppText variant="h3">{idea.title}</AppText>
                      {idea.description ? <AppText variant="bodyMuted">{idea.description}</AppText> : null}
                    </View>
                    {canDelete ? (
                      <TouchableOpacity
                        onPress={() =>
                          confirmAction(
                            "Supprimer cette idée ?",
                            `« ${idea.title} » et ses votes disparaîtront pour tout le groupe.`,
                            "Supprimer",
                            () => deleteIdea.mutate(idea.id, { onError: (e) => toast.error(friendlyError(e)) }),
                          )
                        }
                        hitSlop={{ top: 14, bottom: 14, left: 14, right: 14 }}
                        accessibilityRole="button"
                        accessibilityLabel={`Supprimer l'idée ${idea.title}`}
                      >
                        <Trash2 size={16} color={colors.textMuted} />
                      </TouchableOpacity>
                    ) : null}
                  </View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Avatar profile={idea.profile} size={24} />
                      <AppText variant="caption">{idea.profile?.name ?? "Membre"} · {formatRelative(idea.created_at)}</AppText>
                    </View>

                    <PressableScale
                      onPress={() => {
                        if (!participate) return toast.info("Seuls les membres peuvent voter.");
                        if (toggleVote.isPending) return;
                        toggleVote.mutate({ ideaId: idea.id, voted: idea.voted }, { onError: (e) => toast.error(friendlyError(e)) });
                      }}
                      accessibilityRole="button"
                      accessibilityLabel={`${idea.voteCount} vote${idea.voteCount > 1 ? "s" : ""}. ${idea.voted ? "Retirer mon vote" : "Voter pour cette idée"}`}
                      accessibilityState={{ selected: idea.voted }}
                      style={{ flexDirection: "row", alignItems: "center", gap: 6, minHeight: 44, paddingHorizontal: 14, borderRadius: radius.pill, backgroundColor: idea.voted ? colors.primary : colors.surface }}
                    >
                      <Flame size={15} color={idea.voted ? "#fff" : colors.textMuted} fill={idea.voted ? "#fff" : "transparent"} />
                      <AppText style={{ fontWeight: "700", fontSize: 13, color: idea.voted ? "#fff" : colors.textMuted }}>{idea.voteCount}</AppText>
                    </PressableScale>
                  </View>

                  {participate ? (
                    <Button
                      title="On l'a fait : créer l'épisode"
                      variant="secondary"
                      icon={<Clapperboard size={16} color={colors.text} />}
                      onPress={() =>
                        router.push({ pathname: "/create-episode/[spaceId]", params: { spaceId, ideaId: idea.id, ideaTitle: idea.title } })
                      }
                    />
                  ) : null}
                </Card>
              </FadeIn>
            );
          })}

          {sorted.length === 0 ? (
            <AppText variant="bodyMuted">Plus d&apos;idée en attente : tout ce qui a été proposé a été fait.</AppText>
          ) : null}

          {done.length > 0 ? (
            <View style={{ gap: spacing.sm, marginTop: spacing.lg }}>
              <AppText variant="overline">Déjà faites</AppText>
              {done.map((idea) => (
                <TouchableOpacity
                  key={idea.id}
                  disabled={!idea.episode_id}
                  activeOpacity={0.8}
                  accessibilityRole="button"
                  accessibilityLabel={`Voir l'épisode de l'idée ${idea.title}`}
                  onPress={() => idea.episode_id && router.push({ pathname: "/episode/[episodeId]", params: { episodeId: idea.episode_id } })}
                >
                  <Card style={{ flexDirection: "row", alignItems: "center", gap: spacing.md }}>
                    <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: colors.accentSoft, alignItems: "center", justifyContent: "center" }}>
                      <Check size={18} color={colors.accent} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <AppText style={{ fontWeight: "700", fontSize: 15, color: colors.text }} numberOfLines={1}>{idea.title}</AppText>
                      <AppText variant="caption">
                        {idea.episode_id ? "Devenue un épisode" : "Faite"} · proposée par {idea.profile?.name ?? "un membre"}
                      </AppText>
                    </View>
                    {idea.episode_id ? <ChevronRight size={18} color={colors.textMuted} /> : null}
                  </Card>
                </TouchableOpacity>
              ))}
            </View>
          ) : null}
        </View>
      )}
    </Screen>
  );
}
