import { useCallback, useEffect, useState } from "react";
import { Platform } from "react-native";
import { friendlyError } from "@/lib/errors";
import { disablePush, enablePush, pushOptedOut, pushPermission, pushSupported, sendTestPush, type PushPermission } from "@/lib/push";
import { useAuth } from "@/providers/auth";
import { useToast } from "@/providers/toast";

/**
 * Push notifications for this account on this device: whether they are on,
 * and the one function allowed to turn them on (it may show the system
 * prompt) or off. Shared by the profile switch and by the offer made right
 * after a review, so both say the same things when it fails.
 *
 * `canAsk` is true only while the system has never been asked: the moment to
 * offer push, since a refused prompt cannot be shown again.
 */
export function usePushSwitch() {
  const toast = useToast();
  const { userId } = useAuth();
  const [enabled, setEnabled] = useState<boolean>(false);
  const [permission, setPermission] = useState<PushPermission | null>(null);
  const [optedOut, setOptedOut] = useState<boolean>(false);
  const [busy, setBusy] = useState<boolean>(false);
  const [testing, setTesting] = useState<boolean>(false);

  useEffect(() => {
    if (!userId) return;
    let active = true;
    // Permission alone is not the answer: the user may have switched push off
    // here while the system permission stays granted.
    Promise.all([pushPermission(), pushOptedOut(userId)])
      .then(([p, out]) => {
        if (!active) return;
        setPermission(p);
        setOptedOut(out);
        setEnabled(p === "granted" && !out);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [userId]);

  const toggle = useCallback(
    async (value: boolean): Promise<boolean> => {
      if (!userId) return false;

      // Off is remembered for this account on this device, so the next launch
      // does not quietly subscribe again.
      if (!value) {
        await disablePush(userId);
        setEnabled(false);
        setOptedOut(true);
        toast.info("Notifications désactivées");
        return false;
      }

      if (pushSupported() === "unsupported") {
        toast.info(
          Platform.OS === "web"
            ? "Ce navigateur ne gère pas les notifications. Installe l'app depuis ton navigateur pour les recevoir."
            : "Les notifications demandent l'app installée, pas Expo Go.",
        );
        return false;
      }

      setBusy(true);
      try {
        const result = await enablePush(userId);
        setEnabled(result === "granted");
        if (result !== "failed") setPermission(result);
        if (result === "granted") {
          setOptedOut(false);
          toast.success("Notifications activées");
        } else if (result === "failed") {
          // Permission is there; the subscription is what broke. Settings won't help.
          toast.error("Notifications autorisées, mais l'inscription de cet appareil a échoué. Réessaie dans un instant.");
        } else if (result === "denied") {
          toast.info(
            Platform.OS === "web"
              ? "Les notifications sont bloquées pour Bobine. Débloque-les dans les réglages du téléphone (iPhone : Réglages › Notifications › Bobine) ou du navigateur (icône à gauche de l'adresse › Notifications)."
              : "Les notifications sont bloquées. Débloque-les dans Réglages du téléphone › Notifications › Bobine.",
          );
        } else {
          toast.info("Autorise les notifications quand ton téléphone te le demande.");
        }
        return result === "granted";
      } catch (e) {
        console.log("[push] activation impossible:", e);
        toast.error("Impossible d'enregistrer cet appareil pour les notifications.");
        return false;
      } finally {
        setBusy(false);
      }
    },
    [userId, toast],
  );

  /** Sends a push to this account and says, in plain words, what came of it. */
  const test = useCallback(async (): Promise<void> => {
    if (!userId) return;
    setTesting(true);
    try {
      const result = await sendTestPush(userId);
      if (result.kind === "sent") {
        toast.success("Notification envoyée. Si rien ne s'affiche, regarde les réglages de notifications du téléphone pour Bobine.");
      } else if (result.kind === "no_device") {
        toast.error("Aucun appareil enregistré pour ton compte. Désactive puis réactive les notifications ici.");
      } else if (result.kind === "failed") {
        toast.error(`Le service de notifications a refusé l'envoi (${result.detail}).`);
      } else {
        toast.info("Envoi en cours, la notification devrait arriver d'ici quelques secondes.");
      }
    } catch (e) {
      toast.error(friendlyError(e));
    } finally {
      setTesting(false);
    }
  }, [userId, toast]);

  const canAsk = permission === "undetermined" && !optedOut && pushSupported() === "supported";
  return { enabled, busy, canAsk, toggle, test, testing };
}
