# Hosted loader validation — 2.6.4

Checked on 2026-11-02.

| Check | Result |
| --- | --- |
| Node regression tests | 80 passed, 0 failed |
| JavaScript syntax | Updated userscript, metadata and builder passed |
| Existing public Vercel files | Entry HTML, styles, runtime modules and both WASM files returned HTTP 200 |
| Actual updated loader with hosted assets | 23 HTTPS GM asset requests succeeded; canvas, verification module and bot panel initialized |
| Saved old localhost asset address | Ignored; no GM asset requests reached localhost or 127.0.0.1 |
| Unavailable asset fixture | One handled load error, no page errors, correct hosted reinstall link |
| Verification, auth, engine, bot runtime and WASM bytes | Eight checked runtime files exactly match the preceding 2.6.3 local project |
| Public 2.6.4 deployment | Not published by this work; replace files in GitHub to deploy |

Browser validation ran the complete updated userscript in isolated Chrome with a GM API shim fetching the real public HTTPS assets. The page, verification SDK and game WebSocket transport were fixtures. No personal browser profile, real login or verification challenge was used. This validates asset loading and interface initialization; it does not claim a fresh live gameplay test.

Changed deployment files: `kateronyx.user.js`, new `kateronyx.meta.js`, `onyx-install.html`, `scripts/build-bots.cjs`, `tests/build.test.cjs`, new `tests/hosted-loader.test.cjs`, new `tests/browser-hosted-loader.py`, and the hosted release documentation.

To reproduce the checks:

```powershell
$testFiles = @(Get-ChildItem -LiteralPath tests -Filter *.test.cjs | ForEach-Object { $_.FullName })
node --test @testFiles
python tests/browser-hosted-loader.py
```

The browser check requires network access, Python Playwright and Chrome at its standard Windows location. The standalone local-trial browser check from 2.6.3 is retained for reference and still expects a local server; it is not the hosted-loader check.
