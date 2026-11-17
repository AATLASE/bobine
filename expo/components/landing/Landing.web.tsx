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

const PAGE_TITLE = "Gather · Vos sorties méritent leur propre série";

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
    title: "Crée ton espace",
    body: "Un espace, c'est ton groupe : ton couple, ta bande ou ta famille. Il a sa propre couverture, comme une affiche de série.",
    img: "/landing/step-space.webp",
    alt: "Quatre amis souriants, bras dessus bras dessous dans un parc en automne",
    tag: "Espace",
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
    a: "Oui. Tu crées ton compte, tes espaces et tes épisodes sans payer quoi que ce soit.",
  },
  {
    q: "Qui peut voir nos épisodes ?",
    a: "Uniquement les membres de ton espace. Pas de profil public, pas de recherche, pas d'inconnus : un espace ne s'ouvre qu'avec une invitation.",
  },
  {
    q: "Participant ou observateur, quelle différence ?",
    a: "Les participants créent des épisodes et écrivent leur review. Les observateurs suivent l'aventure et voient tout, sans avoir à écrire.",
  },
  {
    q: "Je peux avoir plusieurs espaces ?",
    a: "Oui : un pour ton couple, un pour ta bande, un pour la famille. Tu passes de l'un à l'autre en un geste.",
  },
  {
    q: "Faut-il télécharger une application ?",
    a: "Non. Gather fonctionne dans le navigateur, et tu peux l'ajouter à ton écran d'accueil pour l'ouvrir comme une vraie app.",
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

function Mark({ className }: { className?: string }) {
  return (
    <span className={`gl-mark ${className ?? ""}`} aria-hidden="true">
      G
    </span>
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
          <a className="gl-logo" href="/" aria-label="Gather, accueil" onClick={(e) => { e.preventDefault(); scroller.current?.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" }); }}>
            <Mark />
            <span className="gl-logo__word">Gather</span>
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
            <Mark />
            <p>
              <strong>Gather</strong>
              <span>Vos moments, en série.</span>
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
            Gather transforme chaque dîner, rando ou concert en épisode. Vous ajoutez les photos, chacun écrit son avis en
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
            Privé : seuls tes invités voient ton espace.
          </p>
        </div>

        <div className="gl-collage" aria-label="Quelques épisodes de groupes Gather">
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
            Trois mots à retenir : <b>espace</b>, <b>épisode</b>, <b>saison</b>. Le reste, c&apos;est vous qui l&apos;écrivez.
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
            Pas de likes, pas d&apos;abonnés, pas d&apos;inconnus. Seules les personnes que tu invites voient ton espace,
            et chacun choisit de participer ou simplement de suivre l&apos;aventure.
          </p>
          <ul className="gl-who" aria-label="Pour qui">
            <li><span>Ton couple</span></li>
            <li><span>Ta bande</span></li>
            <li><span>Ta famille</span></li>
          </ul>
          <p className="gl-body">Ou les trois : un espace pour chacun, et tu passes de l&apos;un à l&apos;autre en un geste.</p>
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
          <h3 id="install-title" className="gl-h3">Gather sur ton téléphone</h3>
          <p>Pas besoin de passer par un store : ajoute Gather à ton écran d&apos;accueil, il s&apos;ouvre comme une app.</p>
          <div className="gl-install__cols">
            <div>
              <p className="gl-install__os">iPhone, avec Safari</p>
              <ol>
                <li><span>Ouvre Gather dans Safari</span></li>
                <li><span>Touche le bouton <b>Partager</b></span></li>
                <li><span>Choisis <b>Sur l&apos;écran d&apos;accueil</b></span></li>
              </ol>
            </div>
            <div>
              <p className="gl-install__os">Android, avec Chrome</p>
              <ol>
                <li><span>Ouvre Gather dans Chrome</span></li>
                <li><span>Touche le menu <b aria-label="trois points">⋮</b></span></li>
                <li><span>Choisis <b>Installer l&apos;application</b></span></li>
              </ol>
            </div>
          </div>
          <InstallButton install={install} className="gl-btn--ink gl-install__cta" label="Ajouter Gather maintenant" />
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
          <p className="gl-body-lg">Crée ton espace en une minute, invite ta bande et lance le premier épisode.</p>
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
