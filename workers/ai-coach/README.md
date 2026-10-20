# AE Coach Worker (Cloudflare Workers AI)

Runs the AI coach for the AE app. Uses Workers AI (runs inside Cloudflare, free daily allowance, no external API key).
Prompts for the two personas are in `src/prompts.js`; change them and redeploy without rebuilding the APK.

## Deploy from the dashboard (no tools needed)
1. dash.cloudflare.com → Workers & Pages → Create → Create Worker → name `ae-coach` → Deploy.
2. Edit code → delete everything → paste the contents of `worker-single-file.js` → Deploy.
3. Settings → Bindings → Add → **Workers AI** → variable name `AI` → Deploy.
4. (Optional) Settings → Variables and Secrets → add secret `APP_KEY` (any long random text), and put the same text in `www/config.js` as `key`.
5. Copy the Worker URL (https://ae-coach.<you>.workers.dev) into `www/config.js` as `url`, push, and the APK rebuilds.

## Deploy with Wrangler
    cd workers/ai-coach && npx wrangler deploy
    npx wrangler secret put APP_KEY   # optional

Check it works: open `<worker-url>/health` → `{"ok":true}`.
