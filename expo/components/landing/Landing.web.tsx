import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { InstallButton, InstallPopup, InstallSheet, useLandingInstall, type LandingInstall } from "./LandingInstall";
import "./landing.css";

/**
 * Public landing page, web only. Rendered at "/" for signed-out visitors by
 * app/(tabs)/_layout.tsx, in place of the tab bar.
 *
 * Written as plain DOM + CSS rather than React Native primitives: a marketing
 * page needs fluid type, media queries, 3D transforms and scroll-driven reveals
 * that react-native-web does not expose.
 */

type Href = "/signup" | "/login";

const FONTS_HREF =
  "https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wdth,wght@12..96,75..100,400..800&family=Figtree:ital,wght@0,400..700;1,400&family=Gochi+Hand&display=swap";

const PAGE_TITLE = "Bobine · Vos sorties méritent leur propre série";

function useFonts() {
  useEffect(() => {
    if (document.getElementById("gl-fonts")) return;
    const pre1 = document.createElement("link");
    pre1.rel = "preconnect";
    pre1.href = "https://fonts.googleapis.com";
    const pre2 = document.createElement("link");
    pre2.rel = "preconnect";
    pre2.href = "https://fonts.gstatic.com";
    pre2.crossOrigin = "anonymous";
    const sheet = document.createElement("link");
    sheet.id = "gl-fonts";
    sheet.rel = "stylesheet";
    sheet.href = FONTS_HREF;
    document.head.append(pre1, pre2, sheet);
  }, []);

  useEffect(() => {
    const previous = document.title;
    document.title = PAGE_TITLE;
    return () => {
      document.title = previous;
    };
  }, []);
}

function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

/* ------------------------------------------------------------------ */
/* Data                                                                */
/* ------------------------------------------------------------------ */

const STEPS = [
  {
    n: "1",
    title: "Crée ta bande",
    body: "Une bande, c'est ton groupe : ton couple, tes amis ou ta famille. Elle a sa propre couverture, comme une affiche de série.",
    img: "/landing/step-space.webp",
    alt: "Quatre amis souriants, bras dessus bras dessous dans un parc en automne",
    tag: "Bande",
  },
  {
    n: "2",
    title: "Invite tes proches",
    body: "Un lien suffit. Participant pour ceux qui vivent les moments, observateur pour ceux qui suivent de loin (coucou Mamie).",
    img: "/landing/step-invite.webp",
    alt: "Deux amis en randonnée qui rient en se tenant par l'épaule, sac au dos",
    tag: "Invitation",
  },
  {
    n: "3",
    title: "Ajoute vos épisodes",
    body: "Un dîner, une rando, un concert : chaque sortie devient un épisode, avec ses photos, ses vidéos et ses petites notes.",
    img: "/landing/step-episode.webp",
    alt: "Un couple sur un vélo électrique dans le désert, elle lève le bras en riant",
    tag: "Épisode",
  },
  {
    n: "4",
    title: "Revis la saison",
    body: "Une saison, c'est la période que vous traversez ensemble. Quand elle se termine, vous la revoyez d'une traite.",
    img: "/landing/step-season.webp",
    alt: "Une bande d'amis en forêt qui fait un selfie, tout le monde sourit",
    tag: "Saison",
  },
] as const;

interface Idea {
  id: string;
  title: string;
  by: string;
  votes: number;
  hue: number;
}

const IDEAS: Idea[] = [
  { id: "lac", title: "Pique-nique au lac", by: "Léa", votes: 4, hue: 150 },
  { id: "karaoke", title: "Karaoké chez Inès", by: "Inès", votes: 3, hue: 22 },
  { id: "escape", title: "Escape game en ville", by: "Tom", votes: 2, hue: 250 },
  { id: "brunch", title: "Brunch du dimanche", by: "Karim", votes: 2, hue: 80 },
];

const REVIEWS = [
  { name: "Inès", stars: 5, quote: "Meilleure soirée du mois. Karim, ton bluff au Time's Up restera dans l'histoire.", hue: 22 },
  { name: "Karim", stars: 4, quote: "J'ai perdu, mais avec classe. On revient pour la revanche.", hue: 80 },
  { name: "Léa", stars: 5, quote: "Le cocktail mystère était une erreur. Je recommence samedi.", hue: 150 },
  { name: "Tom", stars: 3, quote: "Trop de bruit, mais j'ai ri du début à la fin.", hue: 250 },
];

const FAQ = [
  {
    q: "C'est vraiment gratuit ?",
    a: "Oui. Tu crées ton compte, tes bandes et tes épisodes sans payer quoi que ce soit.",
  },
  {
    q: "Qui peut voir nos épisodes ?",
    a: "Uniquement les membres de ta bande. Pas de profil public, pas de recherche, pas d'inconnus : une bande ne s'ouvre qu'avec une invitation.",
  },
  {
    q: "Participant ou observateur, quelle différence ?",
    a: "Les participants créent des épisodes et écrivent leur review. Les observateurs suivent l'aventure et voient tout, sans avoir à écrire.",
  },
  {
    q: "Je peux avoir plusieurs bandes ?",
    a: "Oui : une pour ton couple, une pour tes amis, une pour la famille. Tu passes de l'une à l'autre en un geste.",
  },
  {
    q: "Faut-il télécharger une application ?",
    a: "Non. Bobine fonctionne dans le navigateur, et tu peux l'ajouter à ton écran d'accueil pour l'ouvrir comme une vraie app.",
  },
];

/* ------------------------------------------------------------------ */
/* Small pieces                                                        */
/* ------------------------------------------------------------------ */

function Stars({ count, label }: { count: number; label?: boolean }) {
  return (
    <span className="gl-stars" aria-label={label ? `${count} étoiles sur 5` : undefined} aria-hidden={label ? undefined : true}>
      {Array.from({ length: 5 }, (_, i) => (
        <svg key={i} viewBox="0 0 20 20" className={i < count ? "is-on" : undefined} aria-hidden="true">
          <path d="M10 1.8l2.5 5.3 5.8.7-4.3 4 1.1 5.7L10 14.7l-5.1 2.8 1.1-5.7-4.3-4 5.8-.7z" />
        </svg>
      ))}
    </span>
  );
}

function Avatar({ name, hue, size = "md" }: { name: string; hue: number; size?: "sm" | "md" }) {
  return (
    <span className={`gl-avatar gl-avatar--${size}`} style={{ "--h": hue } as React.CSSProperties} aria-hidden="true">
      {name.charAt(0)}
    </span>
  );
}

/** Le symbole Bobine : une bobine, cinq places autour d'un moment partagé. */
const REEL_PATH = "M0.00,50.00a50.00,50.00 0 1,0 100.00,0a50.00,50.00 0 1,0 -100.00,0ZM39.25,22.00a10.75,10.75 0 1,0 21.50,0a10.75,10.75 0 1,0 -21.50,0ZM65.88,41.35a10.75,10.75 0 1,0 21.50,0a10.75,10.75 0 1,0 -21.50,0ZM55.71,72.65a10.75,10.75 0 1,0 21.50,0a10.75,10.75 0 1,0 -21.50,0ZM22.79,72.65a10.75,10.75 0 1,0 21.50,0a10.75,10.75 0 1,0 -21.50,0ZM12.62,41.35a10.75,10.75 0 1,0 21.50,0a10.75,10.75 0 1,0 -21.50,0Z";

function Mark({ className }: { className?: string }) {
  return (
    <svg className={`gl-mark ${className ?? ""}`} viewBox="0 0 100 100" aria-hidden="true" focusable="false">
      <path className="gl-mark__disk" d={REEL_PATH} fillRule="evenodd" />
      <circle className="gl-mark__hub" cx="50" cy="50" r="7.5" />
    </svg>
  );
}

/** Le logotype « bobine », dont le premier « o » est le symbole. */
function Logotype({ className }: { className?: string }) {
  return (
    <svg className={`gl-logotype ${className ?? ""}`} viewBox="-6 0 354.4 120.0" role="img" aria-label="Bobine">
      <path d="M39.6 96.4Q34.6 96.4 30.85 94.5Q27.1 92.6 24.75 88.8Q22.40 85.0 21.6 79.4H19.70L19.40 95.0H6.2V69.1V23.0H22.3V40.5Q22.3 42.9 21.95 45.55Q21.6 48.19 21.05 51.09Q20.5 54.0 19.90 57.3H22.20Q23.6 51.9 25.90 48.3Q28.20 44.69 31.65 42.84Q35.1 41.0 39.80 41.0Q46.40 41.0 51.25 44.4Q56.1 47.8 58.8 54.05Q61.5 60.3 61.5 69.0Q61.5 77.4 58.85 83.55Q56.2 89.7 51.30 93.05Q46.40 96.4 39.6 96.4ZM33.6 83.4Q36.9 83.4 39.40 81.55Q41.90 79.7 43.25 76.35Q44.6 73.0 44.6 68.5Q44.6 63.9 43.3 60.65Q42.0 57.4 39.65 55.59Q37.30 53.8 34.0 53.8Q31.8 53.8 29.95 54.59Q28.1 55.4 26.70 56.8Q25.3 58.19 24.3 59.94Q23.3 61.69 22.8 63.64Q22.3 65.6 22.3 67.5V69.6Q22.3 71.7 22.9 74.1Q23.5 76.5 24.85 78.6Q26.20 80.7 28.35 82.05Q30.5 83.4 33.6 83.4Z M165.6 96.4Q160.6 96.4 156.85 94.5Q153.1 92.6 150.75 88.8Q148.4 85.0 147.6 79.4H145.7L145.4 95.0H132.2V69.1V23.0H148.3V40.5Q148.3 42.9 147.95 45.55Q147.6 48.19 147.05 51.09Q146.5 54.0 145.9 57.3H148.2Q149.6 51.9 151.89 48.3Q154.2 44.69 157.64 42.84Q161.1 41.0 165.8 41.0Q172.4 41.0 177.25 44.4Q182.1 47.8 184.8 54.05Q187.5 60.3 187.5 69.0Q187.5 77.4 184.85 83.55Q182.2 89.7 177.3 93.05Q172.4 96.4 165.6 96.4ZM159.6 83.4Q162.9 83.4 165.4 81.55Q167.9 79.7 169.25 76.35Q170.6 73.0 170.6 68.5Q170.6 63.9 169.3 60.65Q168.0 57.4 165.65 55.59Q163.3 53.8 160.0 53.8Q157.8 53.8 155.95 54.59Q154.1 55.4 152.7 56.8Q151.3 58.19 150.3 59.94Q149.3 61.69 148.8 63.64Q148.3 65.6 148.3 67.5V69.6Q148.3 71.7 148.9 74.1Q149.5 76.5 150.85 78.6Q152.2 80.7 154.35 82.05Q156.5 83.4 159.6 83.4Z M197.0 95.0V42.19H213.10V95.0ZM205.10 34.80Q200.50 34.80 198.05 32.85Q195.60 30.90 195.60 27.29Q195.60 23.5 198.05 21.55Q200.50 19.60 205.10 19.60Q209.8 19.60 212.25 21.55Q214.70 23.5 214.70 27.20Q214.70 30.90 212.25 32.85Q209.8 34.80 205.10 34.80Z M225.6 95.0V63.2V42.19H238.60L238.8 57.69H240.8Q242.10 52.09 244.5 48.3Q246.9 44.5 250.60 42.65Q254.3 40.8 259.3 40.8Q268.6 40.8 273.45 47.3Q278.3 53.8 278.3 68.0V95.0H262.1V69.8Q262.1 61.6 259.75 57.84Q257.4 54.09 252.8 54.09Q249.0 54.09 246.55 56.39Q244.10 58.69 242.90 62.5Q241.70 66.3 241.70 71.0V95.0Z M315.0 96.4Q308.4 96.4 303.2 94.65Q298.0 92.9 294.35 89.5Q290.7 86.1 288.79 81.1Q286.9 76.1 286.9 69.6Q286.9 63.3 288.75 58.0Q290.59 52.69 294.04 48.84Q297.5 45.0 302.54 42.9Q307.59 40.8 313.9 40.8Q320.3 40.8 325.15 42.84Q330.0 44.9 333.15 48.9Q336.3 52.9 337.8 58.65Q339.3 64.4 338.8 71.8L297.5 72.1V63.7L329.6 63.4L323.9 67.3Q324.6 62.3 323.3 59.15Q322.0 56.0 319.5 54.55Q317.0 53.09 314.09 53.09Q310.59 53.09 307.95 55.0Q305.3 56.9 303.8 60.5Q302.3 64.1 302.3 69.3Q302.3 77.5 305.85 81.2Q309.4 84.9 314.9 84.9Q317.59 84.9 319.4 84.15Q321.2 83.4 322.35 82.25Q323.5 81.1 324.15 79.69Q324.8 78.3 325.2 77.0L339.2 80.0Q338.4 83.7 336.65 86.7Q334.9 89.7 331.95 91.9Q329.0 94.1 324.85 95.25Q320.7 96.4 315.0 96.4Z" fill="currentColor" />
      <path className="gl-mark__disk" d="M66.49,68.60a28.91,28.91 0 1,0 57.82,0a28.91,28.91 0 1,0 -57.82,0ZM89.18,52.41a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM104.58,63.60a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM98.70,81.70a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM79.67,81.70a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0ZM73.79,63.60a6.22,6.22 0 1,0 12.43,0a6.22,6.22 0 1,0 -12.43,0Z" fillRule="evenodd" />
      <circle className="gl-mark__hub" cx="95.40" cy="68.60" r="4.34" />
    </svg>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                                */
/* ------------------------------------------------------------------ */

export default function Landing() {
  useFonts();
  const router = useRouter();
  const scroller = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(false);
  const install = useLandingInstall();

  const go = useCallback(
    (href: Href) => (event: React.MouseEvent<HTMLAnchorElement>) => {
      // Let modified clicks (new tab, etc.) behave like normal links.
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
      event.preventDefault();
      router.push(href);
    },
    [router],
  );

  const scrollTo = useCallback((id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: prefersReducedMotion() ? "auto" : "smooth", block: "start" });
    // Move focus for keyboard and screen-reader users without a second jump.
    el.setAttribute("tabindex", "-1");
    el.focus({ preventScroll: true });
  }, []);

  // Nav gets its rule and backdrop once the hero has started to move.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const onScroll = () => setScrolled(root.scrollTop > 12);
    onScroll();
    root.addEventListener("scroll", onScroll, { passive: true });
    return () => root.removeEventListener("scroll", onScroll);
  }, []);

  // Scroll reveals. Content is visible by default; the class only exists once
  // JS confirms it can bring things back in.
  useEffect(() => {
    const root = scroller.current;
    if (!root) return;
    const targets = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return;
    root.classList.add("gl-js");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-in");
            io.unobserve(entry.target);
          }
        }
      },
      { root, rootMargin: "0px 0px -12% 0px", threshold: 0.12 },
    );
    targets.forEach((t) => io.observe(t));
    return () => io.disconnect();
  }, []);

  return (
    <div className="gl-root" ref={scroller}>
      <a className="gl-skip" href="#contenu" onClick={(e) => { e.preventDefault(); scrollTo("contenu"); }}>
        Aller au contenu
      </a>

      <header className={`gl-nav${scrolled ? " is-scrolled" : ""}`}>
        <div className="gl-wrap gl-nav__inner">
          <a className="gl-logo" href="/" aria-label="Bobine, accueil" onClick={(e) => { e.preventDefault(); scroller.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }); }}>
            <Mark className="gl-logo__mark" />
            <Logotype className="gl-logo__word" />
          </a>
          <nav className="gl-nav__links" aria-label="Sections de la page">
            <button type="button" onClick={() => scrollTo("comment")}>Comment ça marche</button>
            <button type="button" onClick={() => scrollTo("idees")}>Idées</button>
            <button type="button" onClick={() => scrollTo("revelation")}>Révélation</button>
            <button type="button" onClick={() => scrollTo("faq")}>FAQ</button>
          </nav>
          <div className="gl-nav__actions">
            <a className="gl-textlink" href="/login" onClick={go("/login")}>
              Se connecter
            </a>
            <a className="gl-btn gl-btn--red gl-btn--sm" href="/signup" onClick={go("/signup")}>
              Créer un compte
            </a>
          </div>
        </div>
      </header>

      <main id="contenu">
        <Hero go={go} install={install} />
        <Steps />
        <Ideas />
        <Reveal />
        <Private />
        <Faq install={install} />
        <FinalCta go={go} />
      </main>

      <footer className="gl-footer">
        <div className="gl-wrap gl-footer__inner">
          <div className="gl-footer__brand">
            <p>
              <Logotype className="gl-footer__logo" />
              <span>Vos sorties méritent leur propre série.</span>
            </p>
          </div>
          <nav className="gl-footer__links" aria-label="Compte">
            <a href="/signup" onClick={go("/signup")}>Créer un compte</a>
            <a href="/login" onClick={go("/login")}>Se connecter</a>
          </nav>
          <p className="gl-footer__credit">Photos : Unsplash</p>
        </div>
      </footer>

      <InstallPopup install={install} />
      <InstallSheet install={install} />
    </div>
  );
}

type Go = (href: Href) => (event: React.MouseEvent<HTMLAnchorElement>) => void;

/* ------------------------------------------------------------------ */
/* Hero                                                                */
/* ------------------------------------------------------------------ */

function Hero({ go, install }: { go: Go; install: LandingInstall }) {
  return (
    <section className="gl-hero" aria-labelledby="hero-title">
      <div className="gl-wrap gl-hero__grid">
        <div className="gl-hero__copy">
          <p className="gl-sticker">Couples · bandes d&apos;amis · familles</p>
          <h1 id="hero-title" className="gl-h1">
            Vos sorties méritent leur propre <span className="gl-hl">série.</span>
          </h1>
          <p className="gl-lede">
            Bobine transforme chaque dîner, rando ou concert en épisode. Vous ajoutez les photos, chacun écrit son avis en
            secret, et tout se révèle d&apos;un coup. Saison après saison, votre histoire se regarde comme une série.
          </p>
          <div className="gl-ctas">
            <a className="gl-btn gl-btn--red gl-btn--lg" href="/signup" onClick={go("/signup")}>
              Créer un compte gratuit
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>
            </a>
            <a className="gl-btn gl-btn--ghost gl-btn--lg" href="/login" onClick={go("/login")}>
              J&apos;ai déjà un compte
            </a>
            <InstallButton install={install} className="gl-btn--sun gl-btn--install" />
          </div>
          <p className="gl-hero__note">
            <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M6 9V7a4 4 0 1 1 8 0v2m-9 0h10v8H5z" /></svg>
            Privé : seuls tes invités voient ta bande.
          </p>
        </div>

        <div className="gl-collage" aria-label="Quelques épisodes de groupes Bobine">
          <figure className="gl-polaroid gl-polaroid--a" style={{ "--r": "-4deg", "--d": "120ms" } as React.CSSProperties}>
            <img src="/landing/hero-rooftop.webp" alt="Une bande d'amis fait un selfie sur un toit au soleil, tout le monde éclate de rire" width={1100} height={1240} fetchPriority="high" />
            <figcaption>S2 · É7 : le rooftop</figcaption>
          </figure>
          <figure className="gl-polaroid gl-polaroid--b" style={{ "--r": "5deg", "--d": "260ms" } as React.CSSProperties}>
            <img src="/landing/hero-beach.webp" alt="Un père porte son bébé sur les épaules à la plage, la mère rit avec eux" width={640} height={720} />
            <figcaption>S1 · É3 : la plage</figcaption>
          </figure>
          <figure className="gl-polaroid gl-polaroid--c" style={{ "--r": "-3deg", "--d": "400ms" } as React.CSSProperties}>
            <img src="/landing/hero-cyclists.webp" alt="Un couple à vélo sur une route de campagne, souriants sous leurs casques" width={640} height={720} />
            <figcaption>S4 · É12 : 60 km !</figcaption>
          </figure>
          <figure className="gl-polaroid gl-polaroid--d" style={{ "--r": "6deg", "--d": "540ms" } as React.CSSProperties}>
            <img src="/landing/hero-picnic.webp" alt="Quatre amis allongés en étoile sur une couverture de pique-nique, morts de rire" width={640} height={720} loading="lazy" />
            <figcaption>S3 · É5 : la sieste</figcaption>
          </figure>

          <div className="gl-chip gl-chip--review" style={{ "--d": "780ms" } as React.CSSProperties} aria-hidden="true">
            <Avatar name="Inès" hue={22} size="sm" />
            <span>
              <Stars count={5} />
              <em>« On y retourne samedi ! »</em>
            </span>
          </div>
          <div className="gl-chip gl-chip--ticket" style={{ "--d": "900ms" } as React.CSSProperties} aria-hidden="true">
            Nouvel épisode <b>S2 · É8</b>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* How it works                                                        */
/* ------------------------------------------------------------------ */

function Steps() {
  return (
    <section id="comment" className="gl-steps" aria-labelledby="steps-title">
      <div className="gl-wrap">
        <header className="gl-section-head" data-reveal>
          <p className="gl-overline">Comment ça marche</p>
          <h2 id="steps-title" className="gl-h2">
            Quatre étapes, zéro prise de tête.
          </h2>
          <p className="gl-section-head__text">
            Trois mots à retenir : <b>bande</b>, <b>épisode</b>, <b>saison</b>. Le reste, c&apos;est vous qui l&apos;écrivez.
          </p>
        </header>
      </div>

      <ol className="gl-strip" aria-label="Les quatre étapes">
        {STEPS.map((s, i) => (
          <li key={s.n} className="gl-frame" data-reveal style={{ "--i": i } as React.CSSProperties}>
            <figure className="gl-frame__film">
              <img src={s.img} alt={s.alt} width={760} height={560} loading="lazy" />
              <span className="gl-frame__tag" aria-hidden="true">{s.tag}</span>
            </figure>
            <div className="gl-frame__text">
              <h3 className="gl-h3">
                <span className="gl-frame__n" aria-hidden="true">{s.n}</span>
                {s.title}
              </h3>
              <p>{s.body}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Ideas and votes                                                     */
/* ------------------------------------------------------------------ */

function Ideas() {
  const [voted, setVoted] = useState<Set<string>>(() => new Set());

  const sorted = useMemo(
    () =>
      IDEAS.map((idea, index) => ({ ...idea, index, total: idea.votes + (voted.has(idea.id) ? 1 : 0) })).sort(
        (a, b) => b.total - a.total || a.index - b.index,
      ),
    [voted],
  );

  const toggle = (id: string) => {
    const apply = () =>
      setVoted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    const doc = document as Document & { startViewTransition?: (cb: () => void) => unknown };
    if (doc.startViewTransition && !prefersReducedMotion()) {
      doc.startViewTransition(() => flushSync(apply));
    } else {
      apply();
    }
  };

  return (
    <section id="idees" className="gl-ideas" aria-labelledby="ideas-title">
      <div className="gl-wrap gl-ideas__grid">
        <div className="gl-ideas__copy" data-reveal>
          <p className="gl-overline">La prochaine sortie</p>
          <h2 id="ideas-title" className="gl-h2">
            Fini les « on verra ».
          </h2>
          <p className="gl-body-lg">
            Chacun propose ses idées, tout le monde vote, la plus populaire passe en tête. Le prochain épisode s&apos;écrit
            presque tout seul.
          </p>
          <p className="gl-body">
            Plus besoin de remonter deux cents messages du groupe pour retrouver qui voulait faire quoi.
          </p>
        </div>

        <div className="gl-ideas__visual" data-reveal>
          <img
            className="gl-ideas__photo"
            src="/landing/ideas-pizza.webp"
            alt="Des amis attablés autour de pizzas dans un café, en pleine discussion"
            width={1100}
            height={1300}
            loading="lazy"
          />
          <div className="gl-board">
            <div className="gl-board__head">
              <p className="gl-board__title">Prochaine sortie ?</p>
              <p className="gl-board__sub">Vote pour tes idées préférées</p>
            </div>
            <ul className="gl-board__list">
              {sorted.map((idea, rank) => {
                const on = voted.has(idea.id);
                return (
                  <li key={idea.id} className={`gl-idea${rank === 0 ? " is-top" : ""}`} style={{ "--vt": `idea-${idea.id}` } as React.CSSProperties}>
                    <Avatar name={idea.by} hue={idea.hue} size="sm" />
                    <span className="gl-idea__text">
                      <span className="gl-idea__title">{idea.title}</span>
                      <span className="gl-idea__by">proposé par {idea.by}</span>
                    </span>
                    <button
                      type="button"
                      className={`gl-vote${on ? " is-on" : ""}`}
                      aria-pressed={on}
                      aria-label={`${on ? "Retirer mon vote pour" : "Voter pour"} ${idea.title}, ${idea.total} votes`}
                      onClick={() => toggle(idea.id)}
                    >
                      <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 15V5m-4.5 4.5L10 5l4.5 4.5" /></svg>
                      <span>{idea.total}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
            <p className="gl-board__hint" aria-hidden="true">essaie, vote !</p>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Secret reviews                                                      */
/* ------------------------------------------------------------------ */

function Reveal() {
  const [revealed, setRevealed] = useState(false);

  return (
    <section id="revelation" className="gl-reveal" aria-labelledby="reveal-title">
      <div className="gl-wrap">
        <header className="gl-section-head gl-section-head--dark" data-reveal>
          <p className="gl-overline">La révélation</p>
          <h2 id="reveal-title" className="gl-h2">
            Les avis restent secrets. Jusqu&apos;au grand soir.
          </h2>
          <p className="gl-section-head__text">
            Après chaque épisode, chacun écrit sa review dans son coin. Tant que tout le groupe n&apos;a pas écrit la sienne,
            personne ne lit rien. Puis tout se dévoile d&apos;un coup, et c&apos;est souvent là qu&apos;on rit le plus.
          </p>
        </header>

        <div className="gl-reveal__stage" data-reveal>
          <figure className="gl-poster">
            <img src="/landing/reveal-bar.webp" alt="Deux amis éclatent de rire autour d'une table dans un bar chaleureux" width={1400} height={800} loading="lazy" />
            <figcaption>
              <span className="gl-poster__ep">S2 · É4</span>
              <span className="gl-poster__title">Le bar à jeux de jeudi</span>
              <span className="gl-poster__status">
                <span className="gl-dots" aria-hidden="true"><i /><i /><i /><i /></span>
                4 sur 4 ont écrit leur avis
              </span>
            </figcaption>
          </figure>

          <div className="gl-reveal__deck">
            <ul className={`gl-reviews${revealed ? " is-revealed" : ""}`}>
              {REVIEWS.map((r, i) => (
                <li key={r.name} className="gl-review" style={{ "--i": i, "--h": r.hue } as React.CSSProperties}>
                  <div className="gl-review__inner">
                    <div className="gl-review__face gl-review__face--sealed" aria-hidden={revealed}>
                      <Mark className="gl-mark--seal" />
                      <span className="gl-review__sealed">Avis scellé</span>
                      <span className="gl-review__who">{r.name}</span>
                    </div>
                    <div className="gl-review__face gl-review__face--open" aria-hidden={!revealed}>
                      <span className="gl-review__head">
                        <Avatar name={r.name} hue={r.hue} size="sm" />
                        <b>{r.name}</b>
                      </span>
                      <Stars count={r.stars} label />
                      <q>{r.quote}</q>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            <div className="gl-reveal__actions">
              <button type="button" className={`gl-btn ${revealed ? "gl-btn--ghost-dark" : "gl-btn--red"} gl-btn--lg`} onClick={() => setRevealed((v) => !v)}>
                {revealed ? "Remettre sous scellés" : "Révéler les 4 avis"}
              </button>
              <p className="gl-reveal__live" aria-live="polite">
                {revealed ? "Les quatre avis sont révélés." : "Tout le monde a écrit : les avis attendent leur révélation."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Privacy                                                             */
/* ------------------------------------------------------------------ */

function Private() {
  return (
    <section className="gl-private" aria-labelledby="private-title">
      <div className="gl-wrap gl-private__grid">
        <figure className="gl-polaroid gl-polaroid--solo" data-reveal style={{ "--r": "-3deg" } as React.CSSProperties}>
          <img src="/landing/private-family.webp" alt="Trois générations d'une famille en promenade dans un parc, les grands-parents en tête" width={700} height={820} loading="lazy" />
          <figcaption>S9 · É2 : balade du dimanche, Papi en tête</figcaption>
        </figure>
        <div className="gl-private__copy" data-reveal>
          <h2 id="private-title" className="gl-h2">
            Privé, entre vous.
          </h2>
          <p className="gl-body-lg">
            Pas de likes, pas d&apos;abonnés, pas d&apos;inconnus. Seules les personnes que tu invites voient ta bande,
            et chacun choisit de participer ou simplement de suivre l&apos;aventure.
          </p>
          <ul className="gl-who" aria-label="Pour qui">
            <li><span>Ton couple</span></li>
            <li><span>Tes amis</span></li>
            <li><span>Ta famille</span></li>
          </ul>
          <p className="gl-body">Ou les trois : une bande pour chacun, et tu passes de l&apos;une à l&apos;autre en un geste.</p>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* FAQ + install                                                       */
/* ------------------------------------------------------------------ */

function Faq({ install }: { install: LandingInstall }) {
  return (
    <section id="faq" className="gl-faq" aria-labelledby="faq-title">
      <div className="gl-wrap gl-faq__grid">
        <div className="gl-faq__list" data-reveal>
          <p className="gl-overline">FAQ</p>
          <h2 id="faq-title" className="gl-h2">
            Les questions qu&apos;on nous pose.
          </h2>
          <div className="gl-accordion">
            {FAQ.map((item) => (
              <details key={item.q} className="gl-qa">
                <summary>
                  <span>{item.q}</span>
                  <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 4v12M4 10h12" /></svg>
                </summary>
                <div className="gl-qa__a">
                  <p>{item.a}</p>
                </div>
              </details>
            ))}
          </div>
        </div>

        <aside className="gl-install" aria-labelledby="install-title" data-reveal>
          <h3 id="install-title" className="gl-h3">Bobine sur ton téléphone</h3>
          <p>Pas besoin de passer par un store : ajoute Bobine à ton écran d&apos;accueil, il s&apos;ouvre comme une app.</p>
          <div className="gl-install__cols">
            <div>
              <p className="gl-install__os">iPhone, avec Safari</p>
              <ol>
                <li><span>Ouvre Bobine dans Safari</span></li>
                <li><span>Touche le bouton <b>Partager</b></span></li>
                <li><span>Choisis <b>Sur l&apos;écran d&apos;accueil</b></span></li>
              </ol>
            </div>
            <div>
              <p className="gl-install__os">Android, avec Chrome</p>
              <ol>
                <li><span>Ouvre Bobine dans Chrome</span></li>
                <li><span>Touche le menu <b aria-label="trois points">⋮</b></span></li>
                <li><span>Choisis <b>Installer l&apos;application</b></span></li>
              </ol>
            </div>
          </div>
          <InstallButton install={install} className="gl-btn--ink gl-install__cta" label="Ajouter Bobine maintenant" />
        </aside>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Final call to action                                                */
/* ------------------------------------------------------------------ */

function FinalCta({ go }: { go: Go }) {
  return (
    <section className="gl-final" aria-labelledby="final-title">
      <div className="gl-wrap gl-final__grid">
        <div className="gl-final__copy" data-reveal>
          <h2 id="final-title" className="gl-h2 gl-final__title">
            Ta prochaine saison commence ce soir.
          </h2>
          <p className="gl-body-lg">Crée ta bande en une minute, invite tes proches et lance le premier épisode.</p>
          <div className="gl-ctas">
            <a className="gl-btn gl-btn--paper gl-btn--lg" href="/signup" onClick={go("/signup")}>
              Créer un compte gratuit
              <svg viewBox="0 0 20 20" aria-hidden="true"><path d="M4 10h11m-4-4 4 4-4 4" /></svg>
            </a>
            <a className="gl-btn gl-btn--ghost-light gl-btn--lg" href="/login" onClick={go("/login")}>
              Se connecter
            </a>
          </div>
        </div>
        <div className="gl-final__photos" data-reveal aria-hidden="true">
          <figure className="gl-polaroid gl-polaroid--f1" style={{ "--r": "-6deg" } as React.CSSProperties}>
            <img src="/landing/final-hug.webp" alt="" width={640} height={760} loading="lazy" />
            <figcaption>S1 · É1 : le tout premier</figcaption>
          </figure>
          <figure className="gl-polaroid gl-polaroid--f2" style={{ "--r": "5deg" } as React.CSSProperties}>
            <img src="/landing/final-run.webp" alt="" width={640} height={760} loading="lazy" />
            <figcaption>S3 · É6 : le sprint</figcaption>
          </figure>
        </div>
      </div>
    </section>
  );
}
