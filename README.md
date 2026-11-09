# FAIZAN PROXY

A responsive Vercel-hosted frontend plus a separately deployed Node.js HTTP(S) gateway intended to run on a US-based server.

## Important capability limits

This is a **web proxy demo**, not a device-wide VPN. It fetches public HTML pages through the external gateway and displays a sanitized snapshot. It intentionally removes scripts, forms, frames, and embedded objects for safety and predictable behavior. Therefore it will **not** fully support complex web apps, sign-ins, interactive pages, streaming, DRM, downloads, or sites that require JavaScript. It does not change the device's IP for other apps.

A true VPN requires a VPN tunnel client on the device and a VPN server; a normal website cannot transparently route all phone traffic.

## 1. Deploy the gateway on a US host

Use a US-region VPS/container host that you control. Build from the `proxy-server` directory (Dockerfile included), expose port `8080`, and set:

- `PORT=8080`
- `FRONTEND_ORIGIN=https://YOUR-VERCEL-DOMAIN`

Choose a host whose server region is actually in the United States. The `/health` endpoint reports `region: "US"` as the configured deployment label; verify the provider's region in its dashboard. Do not set the label to US if the machine is elsewhere.

After deployment, test `https://YOUR-GATEWAY-DOMAIN/health`. It should return JSON with `"ok":true`.

## 2. Deploy the frontend to Vercel

Import this project into Vercel, set the project root to the repository root, and deploy. The static site is in `public/`. If Vercel's static build configuration rejects `vercel.json` in your account, create a static project with `public` as the output directory instead.

Open the deployed site, paste the gateway's public HTTPS URL into “Proxy server API address”, then enter a public HTTP(S) website URL and press CONNECT.

## Security notes

- The gateway blocks private, loopback, link-local, and reserved IP destinations, including DNS names that resolve to them.
- Redirect destinations are revalidated.
- Requests are limited to HTML/XHTML, 2 MB, 12 seconds, and four redirects.
- Scripts, forms, frames and embeds are removed from returned pages.
- Keep the gateway private to your own project/users where possible. Add authentication, quotas, abuse monitoring, and provider firewall controls before public launch.
- This starter is not a production anonymity or privacy service. Do not enter passwords or sensitive information into proxied pages.

## Project layout

- `public/index.html` — responsive FAIZAN PROXY UI
- `proxy-server/server.js` — external gateway with SSRF protections
- `proxy-server/Dockerfile` — container build
- `vercel.json` — static Vercel routing
