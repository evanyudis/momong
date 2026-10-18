# Staging

Frontend: `https://staging.momong.evanyudis.com`. API: `https://momong-api-staging.evanyudis.my.id`. The API is a separate process on the VPS at port 8789 and an empty Neon `staging` branch. It is not production data.

`main` stays production. The long-lived `staging` branch is what Vercel deploys to the staging domain. Host-matched rewrites in `vercel.json` run first and send that host's proxied paths to the staging API: `/api/:path*`, `/sync`, `/me`, `/household/:path*`, `/wishlist/:path*`, `/billing/:path*`. Every other host, including production and `*.vercel.app` previews, keeps `https://momong-api.evanyudis.my.id`. There is no catch-all rewrite in front of those paths, so the SPA fallback cannot swallow them. `buildCommand` stays `VITE_PLUS_ENABLED=false`.

Preview URLs on `*.vercel.app` still talk to the production API. QA uses the staging domain.

## Promote a PR branch

Vercel redeploys the staging domain when `staging` moves.

Add the branch on top of current staging:

```bash
git checkout staging && git pull && git merge --no-ff origin/<feature-branch> && git push
```

Reset `staging` to `main`, then add the branch:

```bash
git checkout staging && git reset --hard origin/main && git merge --no-ff origin/<feature-branch> && git push --force-with-lease
```

Force-push `staging` only. Never force-push `main`. The reset path needs the host rewrites already on `main` (VAN-101). If they are not merged yet, cherry-pick that commit onto `staging` before promoting.

## QA checklist

Test accounts are names and roles only: QA Ibu and QA Ayah for the partner flow. Credentials stay outside this doc. Google login uses the QA person's own Google account.

Plus stays off (`VITE_PLUS_ENABLED=false` on the frontend, `PLUS_ENABLED=false` on the API). Midtrans is sandbox only. The sandbox webhook points at production, so do not test payment on staging.

- [ ] Google login
- [ ] Email login
- [ ] Partner invite from WhatsApp, end to end, on iOS
- [ ] Partner invite from WhatsApp, end to end, on Android
- [ ] Offline (open the PWA, then load a screen with the network off)

First pass is the partner-invite flow (VAN-95) on staging before that work merges to `main`.

## Rollback

Put `staging` back to the last good commit and push. Force-with-lease is allowed on `staging` only:

```bash
git checkout staging && git reset --hard <good-sha> && git push --force-with-lease
```

Vercel redeploys that commit to the staging domain. Production rewrites are the unconditional rules after the host match, so a staging rollback does not change the production API destination.

## Manual steps (Evan)

Do not automate these. VAN-101 and VAN-102:

- Vercel project `momong`: add domain `staging.momong.evanyudis.com` and map it to Git branch `staging`.
- DNS for that hostname (the record Vercel shows).
- Google Cloud Console: OAuth authorized JavaScript origin and redirect URI for `https://staging.momong.evanyudis.com`.
