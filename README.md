# Abhyasa (ಅಭ್ಯಾಸ)

Daily study routine app for a Class 7 CBSE student, with a parent view.
One codebase: web app (desktop/any browser, installable) + Android app (Capacitor).

- **Student:** Today checklist (log classes → homework → learn → practice → revise), weekend test, Mistake Book, calendar, reward wallet.
- **Parent:** progress dashboard, import/assign tests, calendar, wallet payouts/bonuses, settings.
- **Data:** Firebase Auth (Google) + Firestore (offline-first). Photos stay on the device.
- **Study pack:** `public/pack/<chapterId>.json` (explainers + question banks). `public/pack/index.json` lists available chapters.

## Deploys
Every push to `main` runs `.github/workflows/build-and-deploy.yml`:
tests → web build → Android APK → deploys site, APK (`/download/abhyasa.apk`) and Firestore rules to Firebase.

Secrets needed: `FIREBASE_SERVICE_ACCOUNT`, `GOOGLE_SERVICES_JSON`.

Web: https://abhyasa-3fe1d.web.app

## Import test format
```
TEST: Science – Ch 7 Heat Transfer
Q: Which mode of heat transfer needs no medium?
A) Conduction  B) Convection  C) Radiation  D) None
ANS: C
WHY: Radiation travels as waves.

Q: Why do we feel cooler near the sea in the afternoon?
TYPE: short
ANS: Sea breeze.
```
Types: mcq (default with options), `tf`, `fill` (alternatives with `|`), `num`, `short` (self-checked).
