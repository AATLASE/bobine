// Build step (see vercel.json): writes dist/join.html, the page served for
// invitation links (/join?code=…). It is the app shell with a link preview
// worded as an invitation, since that link is what people paste into WhatsApp.
//
// Fails the build rather than ship without it: /join is rewritten to this
// file, so a missing join.html would break every invitation link.
import fs from "node:fs";
import path from "node:path";

const dist = path.resolve(process.argv[2] ?? "dist");
const shell = fs.readFileSync(path.join(dist, "index.html"), "utf8");

const swaps = [
  [/(<meta property="og:title" content=")[^"]*(")/, "$1Rejoins-moi sur Bobine$2"],
  [
    /(<meta property="og:description" content=")[^"]*(")/,
    "$1Tu es invité·e dans notre bande : on y garde nos sorties, chacun écrit sa review en secret, et tout se révèle d'un coup.$2",
  ],
];

let page = shell;
for (const [pattern, replacement] of swaps) {
  if (!pattern.test(page)) {
    console.error(`[invite-page] ${pattern} not found in dist/index.html`);
    process.exit(1);
  }
  page = page.replace(pattern, replacement);
}

fs.writeFileSync(path.join(dist, "join.html"), page);
console.log("[invite-page] dist/join.html written");
