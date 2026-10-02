# CAMPUS MARKET

A responsive marketplace front-end for GROUP A MEMBERS KU MASAKA E-commerce 2026.

## Included
- Public marketplace with category and business-name/product search.
- User sign-up/login, cart, checkout flow and feedback.
- Business registration and dashboard for products, stock, discounts, sales and charts.
- Admin dashboard for users, businesses, products, traffic, progression and feedback.
- Six pickup/delivery locations with coordinates stored for future map integration.
- Consent-first cookies/data-use prompt.
- Client-side image compression and lazy loading for product images.
- Each business sets its own accepted payment methods (MTN MoMo, Airtel Pay, Mastercard) from its
  dashboard; checkout only offers a method every business in the shopper's cart actually accepts.
- Per-product, per-town delivery fees that a business sets from the product form, hard-capped at
  UGX 10,000; shown and added to the total automatically at checkout.
- Two-way messaging: a shopper's "Message seller" opens a real conversation thread the business can
  reply to from its dashboard, and the shopper sees the reply (with an unread badge) in a Messages panel.
- Optional free shared-database sync (Firebase/Firestore) so products, sign-ups and orders are visible
  across every device, including the admin panel — see "Connect a shared database" below.
- Responsive desktop/mobile styling in black, dark brown, yellow, white and navy, with a custom logo mark
  and hero illustration rather than stock icons.

## Fixes in this update
- **"View public site" did nothing from the business dashboard or admin panel.** Both pages attached a
  click-handler to *every* sidebar link, including plain navigation links, and called
  `preventDefault()` on all of them. Fixed in `js/dashboard.js` and `js/admin.js` to only intercept
  links that are actually section-switch tabs (`a[data-section]`).
- **New business sign-ups never reached the dashboard.** `handleSignup()` in `js/main.js` declared a
  local variable named `location`, which shadowed the real `window.location` for the rest of that
  function, so `location.href = "business-dashboard.html"` silently did nothing. Renamed the variable
  and switched to `window.location.href`.
- **The cart drawer rendered behind the header**, hiding its title and close button. A later styling
  pass had added a second `.topbar` rule with `z-index: 100`, overriding the original `z-index: 40` and
  putting the sticky header above the cart drawer (`z-index: 90`) despite the drawer being declared
  higher up in the stylesheet. Fixed the duplicate rule and raised the drawer's z-index for a safety
  margin.
- **Products, sign-ups and messages not visible across devices** — see "Connect a shared database"
  below; this is solved by turning on the optional Firestore sync, not by a one-file patch, since a
  static site has nowhere shared to store data until you add one.

## Important deployment note
This ZIP is a browser-based prototype/demo: its current data layer uses `localStorage`. That means separate visitors do NOT share one production database, and the payment button records a demo order rather than charging a real MoMo/card account.

For production Git deployment, connect `js/data.js` to your server API/database and connect the checkout endpoint to an approved MTN MoMo and card payment gateway. Do not put payment secrets, database passwords, or admin passwords in browser JavaScript.

The UI is intentionally structured so the browser data layer can be replaced by API calls without rebuilding the pages.

## Why uploaded products, new users and new businesses don't show up everywhere
This is the localStorage limitation above, in practice: `localStorage` belongs to one browser on one
device. If a business uploads a product on their phone, that product is written into their phone's
browser only — it was never sent anywhere else, so a shopper on a laptop, or the admin panel opened on a
different computer, has no way to see it. The same is true for new user and business sign-ups. This is
expected behaviour for the plain version of the site, not a bug to patch inside one file — it is a direct
consequence of there being no shared server yet.

There are two ways to fix it, below: a free 5-minute option that keeps this as a static site, and the
fuller production path already described elsewhere in this document.

## Connect a shared database (fixes cross-device visibility, free, ~5 minutes)
The site now ships with an optional sync layer that mirrors products, businesses, users, orders and
feedback to a free Firebase (Firestore) database, so every device sees the same data — including the
admin panel. It is off by default; the site behaves exactly as before until you turn it on.

1. Go to https://console.firebase.google.com, sign in, and click **Add project** (any name, Analytics
   optional).
2. Inside the project, click the **`</>`** (Web) icon to register a web app, then copy the `firebaseConfig`
   values it shows you.
3. In the left menu open **Build > Firestore Database > Create database**, pick a nearby region, and start
   in test mode.
4. Open the **Rules** tab for Firestore and paste in the rules shown below, then **Publish**.
5. Open `js/firebase-config.js`, paste your config values into `FMG_FIREBASE_CONFIG`, and set
   `FMG_CLOUD_ENABLED = true`.
6. Re-deploy/re-upload the site. Open it on two different devices or browsers — a product uploaded on one
   should now appear on the other within a second or two, and the admin panel will show every user and
   business as soon as they sign up, from any device.

No other file needs to change — `js/data.js` is the only place that talks to Firestore, exactly the same
principle used for the plain localStorage version.

### Firestore security rules
Paste this into the Firestore **Rules** tab (replacing the default test-mode rules, which expire after 30
days):

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if true;
    }
  }
}
```

**Read this before you publish it.** `allow read, write: if true` means anyone who has your site's public
Firebase config (which is normal and expected to be visible in a website's own source code) can read
*and write* every record in the database — fine for a coursework demo where the risk is low, but not
something to leave in place once the site holds real customers' data or money. Before a real launch,
tighten this to require Firebase Authentication and check `request.auth != null` (and, for admin-only
actions, a custom claim identifying the admin account) rather than leaving the database open to everyone.

### Checking it's working
The admin panel's Overview page now shows a **Data storage status** badge: "Connected — shared across
every device" once Firestore is wired up correctly, or "Local only" if `FMG_CLOUD_ENABLED` is still
`false` or the config values are wrong. If it stays on "Local only" after you've followed the steps above,
open the browser console (F12) on the page — sync errors are logged there with the words "Cloud sync".

## Local test
Open `index.html` in a modern browser. For the most reliable local testing use a static server, e.g.:
`python3 -m http.server 8080`
then open `http://localhost:8080/` from this project's folder.

Demo admin credentials currently displayed by the prototype:
ADMIN GROUP A / KU MASAKA

Demo business logins (all use password `demo1234`), each with a different mix of payment methods and
delivery towns already configured so checkout has real data to work against:
- kasese.electro@example.com — MoMo + Mastercard, delivers to Kampala and Gayaza
- masaka.threads@example.com — MoMo + Airtel Pay, delivers to Masaka, Kampala University Masaka and Ssembabule
- gayaza.office@example.com — MoMo + Mastercard, delivers to Gayaza and Kampala
- kyotera.agro@example.com — MoMo + Airtel Pay, delivers to Kyotera and Masaka

Change all of these before production and move authentication to the server.


## GitHub deployment
Upload the contents of this package to the root of the repository so that
`index.html` is at the repository root. If GitHub Pages is used, set the
publishing source to the branch and folder containing `index.html`.

For production use, replace the browser `localStorage` data layer with a
server API and database, and connect checkout to approved payment providers.
The demo credentials in the prototype must not be used as production
credentials.
