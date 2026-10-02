/* ============================================================
   CAMPUS MARKET — firebase-config.js

   WHY THIS FILE EXISTS
   ---------------------
   Out of the box, the site stores everything in the browser's own
   localStorage. That is why a product a business uploads on their
   phone doesn't show up on a shopper's laptop, and why the admin
   panel only ever sees accounts created on the same device/browser
   it is opened in — localStorage never leaves that one browser.

   Filling in this one file connects the site to a free, shared
   Firebase (Firestore) database instead, so products, businesses,
   users, orders and feedback saved on ANY device show up for
   everyone else — including the admin — within a second or two.
   No other file needs to change.

   HOW TO GET THE VALUES BELOW (about 5 minutes, no credit card)
   ---------------------------------------------------------------
   1. Go to https://console.firebase.google.com and sign in with any
      Google account.
   2. Click "Add project", give it any name (e.g. "campus-market"),
      and finish the wizard (you can turn Google Analytics off).
   3. Inside the project, click the "</>" (Web) icon to register a
      web app. Give it a nickname and click "Register app". Firebase
      will show you a firebaseConfig object — copy those values into
      FMG_FIREBASE_CONFIG below.
   4. In the left-hand menu, open "Build > Firestore Database" and
      click "Create database". Choose a region close to Uganda
      (e.g. europe-west1) and start in "test mode" for now.
   5. Open the "Rules" tab of Firestore and paste in the rules from
      README.md (section "Firestore security rules"), then Publish.
   6. Set FMG_CLOUD_ENABLED to true below and save this file.
   7. Re-upload/deploy the site. Open it on two different devices —
      a product uploaded on one should now appear on the other.

   Leaving FMG_CLOUD_ENABLED as false keeps the site fully working
   exactly as before (single-device demo mode, using localStorage).
   ============================================================ */

const FMG_CLOUD_ENABLED = false;

const FMG_FIREBASE_CONFIG = {
  apiKey: "PASTE_YOUR_API_KEY_HERE",
  authDomain: "PASTE_YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID"
};
