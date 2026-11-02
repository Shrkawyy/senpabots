# Onyx hosted release 2.6.4

The previous 2.6.3 download was a local trial. Uploading it unchanged kept `http://127.0.0.1:3020/` as the asset source, so each player's computer tried to reach its own local server. The CSS failures and blank screen occurred before connecting to the game server.

## Apply this release

Replace the files in the root of **Shrkawyy/senpabots** with this release. Keep `index.html`, `assets/` and `kateronyx.user.js` at the deployment root, with no extra enclosing folder. Wait for the GitHub deployment to finish in Vercel.

Install or update the userscript from:

<https://senpabots.vercel.app/kateronyx.user.js>

The installer page is <https://senpabots.vercel.app/onyx-install.html>. Check Tampermonkey shows **2.6.4**, disable other Senpa scripts, then press Ctrl+F5 on <https://senpa.io/web/>. Friends install this same script; they do not need Node.js or a local server.

The standalone `kateronyx.user.js` supplied with this release can also be imported into Tampermonkey immediately: it points to the already deployed Vercel game assets. Upload the matching release files for the permanent installer and future updates.

## Scope

- Asset source: `https://senpabots.vercel.app/`, ignoring stale local-trial settings.
- Update checks: `kateronyx.meta.js`; downloads: `kateronyx.user.js`, both over HTTPS.
- A failed parallel stylesheet request is handled by the loader instead of producing unhandled promise errors.
- The error screen and installer explain hosted recovery instead of instructing players to run localhost.
- Rebuilding the embedded bot assets also generates matching userscript metadata.

The verification module, authentication protocol, game renderer, bot behavior and WASM binaries are unchanged from the supplied 2.6.3 project. The user has reported the CAPTCHA problem solved; this update addresses asset hosting only.

Validation evidence is described in `HOSTED-VALIDATION.md`. Automated browser checks do not claim successful live gameplay or solve any real verification challenge.
