# Leeward Vendor Portal

The website vendors use to see bid invites, submit bids, keep their W-9 / COI current and manage their team's logins. It's a plain static site (HTML, CSS, JS — no build step), deployed on its own Vercel project, separate from the Staff Portal.

It uses the **same Supabase project** as the Staff Portal, but vendors never get a Supabase login. Every page talks only to three Edge Functions that live in the Staff-App repo:

| Function | What it does | Deploy flag |
|---|---|---|
| `vendor-auth` | email sign-in links, the "View Invite & Bid" button, sign out | `--no-verify-jwt` |
| `vendor-apply` | the New Vendor Portal Access Request form | `--no-verify-jwt` |
| `vendor-api` | everything a signed-in vendor does | `--no-verify-jwt` |

Those functions only ever return the signed-in vendor's own company's data, and the database tables stay locked to staff.

## Pages

| Page | Who | What |
|---|---|---|
| `index.html` | everyone | Sign in (emails a one-time link, no password) + link to the FAQ |
| `auth.html` | from the email | Turns the sign-in link into a session |
| `i.html` | from a bid invite email | "View Invite & Bid" button — signs them in and opens the invite |
| `apply.html` | new vendors | New Vendor Portal Access Request (W-9 upload, SSN/FID, COI date) |
| `faq.html` | everyone | Vendor FAQ |
| `pending.html` | applied, not approved yet | Waiting-for-approval screen |
| `invites.html` | approved vendors | My Invites (open + past) |
| `invite.html?id=` | approved vendors | Invite detail, plans download, Bidding / Not Bidding, submit bid |
| `profile.html` | approved vendors | Company info, team logins (account holder only), my info, W-9 / COI |

Every page has the English / Español circle in the bottom right. The choice is saved on the vendor's login, so their emails come in that language too. All text is in `js/i18n.js`.

## Files

```
css/styles.css     copy of the Staff Portal stylesheet (same look) — re-copy it when the staff one changes
css/portal.css     vendor-only additions (language circle, FAQ, waiting screen, phone layouts)
js/config.js       Supabase URL + publishable key (public values, same as the Staff Portal)
js/i18n.js         every English / Spanish string
js/portal.js       shared: API calls, session, language, header + sidebar
js/invites.js, js/invite.js, js/profile.js   page code
js/vendor/         supabase-js 2.45.4 (only used for direct file uploads)
vercel.json        security headers
```

## Run it locally (VS Code)

1. Open `leeward-vendor-portal.code-workspace` in VS Code.
2. Install the **Live Server** extension (VS Code will suggest it), then click **Go Live**. The site opens at `http://127.0.0.1:5501`.
3. It talks to the real Supabase project. To sign in locally, the sign-in links in emails point to `VENDOR_PORTAL_URL`, so for local testing either temporarily set that secret to `http://127.0.0.1:5501`, or copy the `#t=…` part of the link onto `http://127.0.0.1:5501/auth.html`.

## First-time setup (in this order)

The Staff-App side has to be set up first (also listed in the Staff-App README under "Vendor Portal + Bid Invites"):

1. Run `sql/supabase-vendor-portal-setup.sql` in the Supabase SQL editor.
2. Deploy the functions from the Staff-App folder:
   ```bash
   supabase functions deploy vendor-auth --no-verify-jwt
   supabase functions deploy vendor-apply --no-verify-jwt
   supabase functions deploy vendor-api --no-verify-jwt
   supabase functions deploy vendor-admin
   supabase functions deploy bid-invites
   supabase functions deploy bid-reminders
   ```

Then deploy this site:

3. Push this folder to its own GitHub repo (e.g. `leeward-vendor-portal`).
4. In Vercel: **Add New → Project**, import that repo. Framework preset: **Other**. No build command, output directory = the repo root. Deploy.
5. Copy the Vercel URL (e.g. `https://leeward-vendor-portal.vercel.app`) and set the Edge Function secrets:
   ```bash
   supabase secrets set VENDOR_PORTAL_URL=https://leeward-vendor-portal.vercel.app
   supabase secrets set STAFF_PORTAL_URL=https://<your staff portal domain>
   ```
   (No trailing slash.) Every email link — sign-in, approval, team invites, "View Invite & Bid" — is built from `VENDOR_PORTAL_URL`, so update it if the domain ever changes (e.g. a custom domain like `vendors.theleewardgroup.com`).
6. Emails go out through Resend (`RESEND_API_KEY`, `RESEND_FROM_EMAIL` / `BID_FROM_EMAIL`, already used by the Staff Portal). The sending domain must be verified in Resend, or vendor emails won't arrive.

## Notes

- Sign-in links work once and expire in 1 hour (72 hours for approval and teammate emails). Sessions last 30 days and renew while in use.
- The sign-in page never says whether an email has an account — an unknown email simply gets no email.
- The "View Invite & Bid" button in an invite email works until 14 days after bids are due. The first person at a company to sign in becomes the account holder.
- Uploads (W-9, COI, proposals) go straight to Supabase Storage through one-time upload slots the functions hand out. PDFs only.
