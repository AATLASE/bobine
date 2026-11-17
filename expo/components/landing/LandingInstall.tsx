import React, { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { getInstallPath, isPhone, promptInstall, subscribeInstall, type InstallPath } from "@/lib/pwa";

/**
 * "Get the app" offers on the public landing page: a small popup at the bottom
 * of the screen, a phone-only button in the hero and in the install card, and
 * the sheet that walks people through it where the browser cannot do it for us.
 *
 * Only Chromium (Android, desktop Chrome / Edge) can install in one tap. Safari
 * on iPhone has no API at all, so there the button opens the three steps
 * instead. Plain DOM, styled by landing.css, like the rest of the landing page.
 * Imported by Landing.web.tsx only, so it never reaches the native bundles.
 */

const SNOOZE_KEY = "gather.landing-install.snoozed-at";
/** A closed popup stays closed for a week, not forever. */
const SNOOZE_MS = 7 * 24 * 60 * 60 * 1000;
/** Let the hero land before asking for anything. */
const POPUP_DELAY_MS = 2500;

function isSnoozed(): boolean {
  try {
    const at = Number(window.localStorage.getItem(SNOOZE_KEY));
    return at > 0 && Date.now() - at < SNOOZE_MS;
  } catch {
    return false;
  }
}

function snooze(): void {
  try {
    window.localStorage.setItem(SNOOZE_KEY, String(Date.now()));
  } catch {
    // Private browsing: the popup simply comes back next visit.
  }
}

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

export interface LandingInstall {
  /** How this visitor can install, or null when they cannot (or already did). */
  path: InstallPath | null;
  /** The phone-only buttons show when this is true. */
  phone: boolean;
  /** The path whose steps are on screen, or null. */
  sheet: Exclude<InstallPath, "prompt"> | null;
  /** One tap: the browser's own dialog when it has one, the steps otherwise. */
  start: () => void;
  closeSheet: () => void;
}

export function useLandingInstall(): LandingInstall {
  const path = useSyncExternalStore(subscribeInstall, getInstallPath, () => null);
  const [phone] = useState<boolean>(() => isPhone());
  const [sheet, setSheet] = useState<LandingInstall["sheet"]>(null);

  const start = useCallback(() => {
    if (path === null) return;
    if (path !== "prompt") {
      setSheet(path);
      return;
    }
    // On "accepted", `appinstalled` follows and every offer disappears.
    promptInstall().then((outcome) => {
      if (outcome === "dismissed") snooze();
    });
  }, [path]);

  const closeSheet = useCallback(() => setSheet(null), []);

  return { path, phone, sheet, start, closeSheet };
}

/* ------------------------------------------------------------------ */
/* Icons                                                               */
/* ------------------------------------------------------------------ */

function Icon({ d }: { d: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

const ICONS = {
  phone: "M6.5 2.5h7a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-7a1 1 0 0 1-1-1v-13a1 1 0 0 1 1-1zM8.5 15h3M10 5.5v5.5m-2.25-2.25L10 11l2.25-2.25",
  share: "M10 12.5V2.5m-3 3 3-3 3 3M6.5 8h-1a1 1 0 0 0-1 1v7.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1V9a1 1 0 0 0-1-1h-1",
  plus: "M4.5 3h11a1.5 1.5 0 0 1 1.5 1.5v11a1.5 1.5 0 0 1-1.5 1.5h-11A1.5 1.5 0 0 1 3 15.5v-11A1.5 1.5 0 0 1 4.5 3zM10 6.5v7M6.5 10h7",
  check: "M4.5 10.5 8 14l7.5-8",
  dotsV: "M10 4.5v.01M10 10v.01M10 15.5v.01",
  dotsH: "M4.5 10h.01M10 10h.01M15.5 10h.01",
  globe: "M10 17.5a7.5 7.5 0 1 0 0-15 7.5 7.5 0 0 0 0 15zM2.5 10h15M10 2.5c2 2.2 3 4.7 3 7.5s-1 5.3-3 7.5c-2-2.2-3-4.7-3-7.5s1-5.3 3-7.5z",
  close: "M5 5l10 10M15 5 5 15",
} as const;

/* ------------------------------------------------------------------ */
/* Buttons                                                             */
/* ------------------------------------------------------------------ */

/** "Télécharger l'application", on phones only, wherever it is placed. */
export function InstallButton({
  install,
  className,
  label = "Télécharger l'application",
}: {
  install: LandingInstall;
  className: string;
  label?: string;
}) {
  if (!install.phone || install.path === null) return null;
  return (
    <button type="button" className={`gl-btn ${className}`} onClick={install.start}>
      <Icon d={ICONS.phone} />
      {install.path === "in-app" ? "Ouvrir dans le navigateur" : label}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Popup                                                               */
/* ------------------------------------------------------------------ */

export function InstallPopup({ install }: { install: LandingInstall }) {
  const [ready, setReady] = useState<boolean>(false);
  const [dismissed, setDismissed] = useState<boolean>(() => isSnoozed());

  useEffect(() => {
    const timer = setTimeout(() => setReady(true), POPUP_DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const { path, phone, sheet } = install;
  // On a computer only Chrome / Edge can install (path "prompt"), so Safari and
  // Firefox desktop visitors get no popup; the other paths are phones and tablets.
  if (!ready || dismissed || path === null || sheet !== null) return null;

  const close = (): void => {
    snooze();
    setDismissed(true);
  };

  let title = "Gather, en vraie app";
  let text = "Sur ton écran d'accueil.";
  let action = "Télécharger";
  if (path === "in-app") {
    title = "Ouvre Gather dans ton navigateur";
    text = "Depuis cette appli, impossible d'installer Gather.";
    action = "Comment ?";
  } else if (!phone && path === "prompt") {
    title = "Gather sur ton ordi";
    text = "Dans sa propre fenêtre, en un clic.";
    action = "Installer";
  }

  return (
    <aside className="gl-popup" aria-label="Installer Gather">
      <img className="gl-popup__icon" src="/icon-192.png" alt="" width={44} height={44} />
      <p className="gl-popup__copy">
        <strong>{title}</strong>
        <span>{text}</span>
      </p>
      <button type="button" className="gl-btn gl-btn--red gl-btn--sm" onClick={install.start}>
        {action}
      </button>
      <button type="button" className="gl-popup__close" onClick={close} aria-label="Plus tard">
        <Icon d={ICONS.close} />
      </button>
    </aside>
  );
}

/* ------------------------------------------------------------------ */
/* Steps sheet                                                         */
/* ------------------------------------------------------------------ */

interface StepItem {
  icon: string;
  title: React.ReactNode;
  hint: string;
}

const STEPS: Record<Exclude<InstallPath, "prompt">, { title: string; lede: string; steps: StepItem[] }> = {
  ios: {
    title: "Ajoute Gather à ton écran d'accueil",
    lede: "Sur iPhone, Apple ne laisse pas un site s'installer tout seul. Trois gestes, dix secondes :",
    steps: [
      {
        icon: ICONS.share,
        title: <>Touche le bouton <b>Partager</b></>,
        hint: "Dans la barre de Safari, ou dans le menu ⋯ selon ta version.",
      },
      {
        icon: ICONS.plus,
        title: <>Choisis <b>Sur l&apos;écran d&apos;accueil</b></>,
        hint: "Fais défiler la liste si tu ne le vois pas.",
      },
      {
        icon: ICONS.check,
        title: <>Touche <b>Ajouter</b></>,
        hint: "Gather apparaît avec tes autres apps.",
      },
    ],
  },
  android: {
    title: "Installe Gather sur ton téléphone",
    lede: "Ton navigateur le fait depuis son menu, en trois gestes :",
    steps: [
      {
        icon: ICONS.dotsV,
        title: <>Touche le menu <b aria-label="trois points">⋮</b></>,
        hint: "En haut à droite, ou en bas selon ton navigateur.",
      },
      {
        icon: ICONS.plus,
        title: <>Choisis <b>Installer l&apos;application</b></>,
        hint: "Ou « Ajouter à l'écran d'accueil ».",
      },
      {
        icon: ICONS.check,
        title: <>Confirme</>,
        hint: "Gather apparaît avec tes autres apps.",
      },
    ],
  },
  "in-app": {
    title: "Ouvre Gather dans ton navigateur",
    lede: "Instagram, TikTok et compagnie ne savent pas installer d'app. Passe d'abord par Safari ou Chrome :",
    steps: [
      {
        icon: ICONS.dotsH,
        title: <>Touche le menu <b>⋯</b> de l&apos;appli</>,
        hint: "En haut ou en bas de l'écran.",
      },
      {
        icon: ICONS.globe,
        title: <>Choisis <b>Ouvrir dans le navigateur</b></>,
        hint: "Puis touche à nouveau « Télécharger l'application ».",
      },
    ],
  },
};

export function InstallSheet({ install }: { install: LandingInstall }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [copied, setCopied] = useState<boolean>(false);
  const { sheet, closeSheet } = install;

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (sheet && !dialog.open) dialog.showModal();
    if (!sheet && dialog.open) dialog.close();
  }, [sheet]);

  const copyLink = async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(window.location.origin);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const content = sheet ? STEPS[sheet] : null;

  return (
    <dialog
      ref={ref}
      className="gl-sheet"
      aria-labelledby="install-sheet-title"
      onClose={closeSheet}
      // A tap on the dimmed backdrop lands on the dialog itself.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeSheet();
      }}
    >
      {content ? (
        <div className="gl-sheet__body">
          <button type="button" className="gl-popup__close gl-sheet__close" onClick={closeSheet} aria-label="Fermer">
            <Icon d={ICONS.close} />
          </button>
          <h2 id="install-sheet-title" className="gl-h3">
            {content.title}
          </h2>
          <p className="gl-sheet__lede">{content.lede}</p>
          <ol className="gl-sheet__steps">
            {content.steps.map((step, i) => (
              <li key={i}>
                <span className="gl-sheet__icon">
                  <Icon d={step.icon} />
                </span>
                <span>
                  <span className="gl-sheet__title">{step.title}</span>
                  <span className="gl-sheet__hint">{step.hint}</span>
                </span>
              </li>
            ))}
          </ol>
          <div className="gl-sheet__actions">
            {sheet === "in-app" ? (
              <button type="button" className="gl-btn gl-btn--ghost" onClick={copyLink}>
                {copied ? "Lien copié !" : "Copier le lien"}
              </button>
            ) : null}
            <button type="button" className="gl-btn gl-btn--red" onClick={closeSheet}>
              C&apos;est noté
            </button>
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
