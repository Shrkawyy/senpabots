# Onyx Senpa local trial — 2.6.3

This project is a local trial of the supplied `senpabots-main(8).zip`. The official Senpa verification remains enabled. No CAPTCHA solver, token reuse, account impersonation or verification bypass is included.

## Run and install

1. Keep the project extracted and run `START-LOCAL.cmd` with Node.js installed.
2. Open <http://127.0.0.1:3020/> and install **Install local userscript** using Tampermonkey. This updates the existing “KaterOnyx FFA for Senpa” script to **2.6.3**.
3. Disable other Senpa userscripts. Open <https://senpa.io/web/> and press Ctrl+F5.
4. Test the player connection first. Complete the official verification when shown; connect bots afterwards. Normal account requirements and server limits still apply.

The script uses files from this local server; keep it running. Opening `index.html` directly is a rendering preview, not an equivalent test of verification on Senpa's origin. The local build intentionally ignores saved hosted asset URLs. It is not a deployed release for friends.

## Changes

- The player and bot connections use independently owned, visible verification requests. An obsolete connection or widget cannot submit a response to a newer connection.
- The widget uses the current official client's public site key, `action: game-connect`, dark theme and `retry: never`. The official Cloudflare SDK is loaded directly from its HTTPS origin, without proxying it.
- Opcode 7 is parsed as `loggedUsersOnly` followed by `version`. The current official reply is opcode 14, response type 1, a little-endian UInt16 token length, then the unchanged 8-bit token.
- The normal browser-session POST is prepared before connecting, using credentials supplied normally by the browser and a bounded three-second wait. No session cookies or login tokens are copied or exported.
- A result submission does not mark a bot ready. The bot waits for the server's ready packet. Retry, cancellation and disconnection remove the correct outstanding challenge.
- Canonical bot protocol and worker sources were aligned to the newer generated runtime already present in the supplied archive before rebuilding it. Existing slot handling and controls were preserved.
- Version 2.6.3 logs the build number, WebSocket open/error/close code, frame count and connection stages. Diagnostics do not inspect frames, tokens, close-reason text or cookies. This distinguishes a transport closure before verification from a rejected verification response.
- The local installer, build scripts and regression tests are included. Game WASM binaries, physics and rendering algorithms were not changed.

## Validation and limits

77 Node regression tests pass. Browser fixtures cover two independent player requests, a bot request through MessageChannel, the official widget options, opcode 14 formatting, and waiting for server acceptance before spawning. Syntax checks pass for the changed runtime JavaScript. All original WASM files retain their original bytes.

The provider and server in these automated tests are synthetic fixtures. They do not demonstrate acceptance by the real Senpa server. The user confirmed that the official game works without the addon. Earlier addon attempts were rejected; the latest supplied screenshot instead shows a disconnection before authentication/verification. Live acceptance of this revised build remains unconfirmed.

For a failed live attempt, retain the `[NEW-SERVER] [RELEASE]`, `[TRANSPORT]`, `[CAPTCHA]` and `[DISCONNECT]` console lines. Do not share cookies, authorization headers, raw verification responses or session tokens.

Reference inspected: the current public official client at <https://senpa.io/web/> and <https://senpa.io/web/assets/main-BZwl-Q7o.js>. Official SDK instructions: <https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/>. Downloaded reference bundles, browser profiles and user console attachments are excluded from the distribution.

## Tests

```powershell
$testFiles = @(Get-ChildItem -LiteralPath tests -Filter *.test.cjs | ForEach-Object { $_.FullName })
node --test @testFiles
python tests/browser-verification.py
```

The browser fixture requires Python Playwright, Chrome at its standard Windows location, and the local server running on port 3020.
