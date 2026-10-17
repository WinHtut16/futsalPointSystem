# Launching the park site on myathida-park.com

The park pages live in this repo (`app/(park)`) on branch `feat/park-site`.
After launch, `myathida-park.com/` is the park landing and the futsal booking
home moves to `/futsal`. Booking, news, accounts and admin keep their URLs.

## 1. Before merging

- [ ] Fill in what you have in `lib/park/content.ts`: address, map links,
      phone, Facebook page, and the hours for each venue. A field left `null`
      is hidden on the page or replaced with an "Ask us" Viber link.
- [ ] Add photos (section 4) and flip their `ready` flags in `lib/park/photos.ts`.
- [ ] Ask a native speaker to read the Burmese in `lib/i18n/namespaces/park.ts`.
- [ ] Go through `docs/park/client-content-checklist.md` with the client.
- [ ] `npm test`, `npm run build`, and `npm run test:e2e` (the booking flow and
      the post-logout redirect now end on `/futsal`).

## 2. Domain

Right now myathida-park.com redirects to the futsal home, and that redirect
is set outside this repo. Find it in one of these places:

- **Vercel**: project `myathida-futsal`, Settings, Domains. If
  `myathida-park.com` is listed with "Redirect to…", edit it to **no redirect**
  so it serves the project directly. Keep `www.myathida-park.com` redirecting
  to the apex.
- **Cloudflare**: the CSP already allows Cloudflare Insights, so the domain
  may be proxied. Check Rules, Redirect Rules (and Page Rules) for a rule on
  `myathida-park.com/*` and remove it.

Don't point the domain at a `*.vercel.app` URL. Myanmar operators block those;
that's why the hub needs the custom domain at all.

## 3. Services that know the hub's address

Do these only if visitors weren't already using myathida-park.com
(that is, if the hub was being reached on another host until now).

- **Supabase**, Authentication, URL Configuration: set Site URL to
  `https://myathida-park.com` and add `https://myathida-park.com/**` to
  Redirect URLs. The admin password reset email uses the Site URL.
- **Billiards and game zone projects** on Vercel: add `myathida-park.com` to
  `HUB_HOSTS`, so their server actions accept requests coming through the hub.
- **Optional:** set `PARK_SITE_URL` on the hub project for preview deployments.
  It defaults to `https://myathida-park.com` and feeds canonical URLs, the
  sitemap, Open Graph and structured data.

## 4. Photos

The photos on the site are made by `scripts/park-photos.py` from the client's
originals in `D:\Myathida\client_photos` (kept outside the repo).

**What the script does to each one:**
- crops it to its slot;
- removes the date stamps;
- evens out colour and light;
- blurs close faces;
- strips EXIF and GPS.

**To swap or add a photo:**
1. Put the original in `client_photos/`.
2. Edit its entry in `scripts/park-photos.json`: source, focus point, crop width, face boxes.
3. Run:

   ```bash
   python scripts/park-photos.py --sheet sheet.png
   ```

4. Check `sheet.png`, which shows each original beside its edit.

**Still missing:**
- Billiards photos, after the room opens. Add slots to `lib/park/photos.ts` and swap the drawn table out in `components/park/venue/BilliardsContent.tsx` and `DayStory.tsx`.
- Food close-ups for the market lane and the poolside tables.

## 5. Animations

Done, in CSS (no files to add). See `docs/park/animations.md`.

## 6. After deploying

- [ ] On a phone using Myanmar mobile data, open `/`, `/games`, `/billiards`,
      `/futsal` and `/book`. Switch to Burmese on each.
- [ ] Log in, log out, and confirm you land on `/futsal`.
- [ ] Paste the link into Viber or Messenger and check the preview card.
- [ ] Check `https://myathida-park.com/robots.txt` and `/sitemap.xml`.
- [ ] Optional: submit the sitemap in Google Search Console.

## Rollback

The park is one route group. To put the futsal home back at `/`, revert the
`feat(park)` commits, or move `app/(site)/futsal/page.tsx` back to
`app/(site)/page.tsx` and delete `app/(park)/page.tsx`.
