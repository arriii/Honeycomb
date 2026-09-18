# HONEYCOMB 🍯
### Personal exposure intelligence for real life

Honeycomb is a mobile-first allergy/exposure companion prototype. The idea is to let a user build a meaningful personal profile, scan almost anything around them, keep a reaction history, and generate an appointment-ready snapshot of what has been happening over time.

> **Prototype rule:** Honeycomb should never claim that an item is medically “safe” or diagnose an allergy from an image. It should show what it found, what matched the user's profile, how much evidence it has, and where it is uncertain.

## What this starter repo includes

### Working website prototype
- Mobile-first layout that also works on desktop
- Prototype sign-up / onboarding
- Personal Honeycomb Profile
- Known / suspected / personal-avoid / tolerated lists kept separate
- Records vault for noting allergy tests, doctor records, and summaries
- Camera / image upload
- Scan modes for labels, products, food, menus, cosmetics, fabrics, plants/nature, and flare-ups
- Simple personalized matching demo
- Easy-to-read evidence confidence visualization
- Reaction journal
- Saved local AI-style chat
- Speech-to-text button where the browser supports it
- Appointment Snapshot report
- Local JSON export
- Installable PWA shell

### ML practice project
A small image-routing model using transfer learning. It learns **what type of thing is in the photo** so the app knows which workflow to use next.

Starter classes:
- ingredient_label
- product_front
- meal_plate
- fabric_label
- plant_nature
- flareup

This is safer and more realistic for a first ML assignment than trying to diagnose allergies from a photo.

## Quick start

Open `index.html` directly, or run a local server:

```bash
python -m http.server 8000
```

Then visit:

```text
http://localhost:8000
```

## GitHub Pages

1. Create a personal repository such as `honeycomb` or `yourusername.github.io`.
2. Upload this whole repository.
3. Push to `main`.
4. Go to **Settings → Pages**.
5. Deploy from GitHub Actions, or choose the root of the `main` branch.
6. Open the site on your phone and use **Add to Home Screen**.

## Recommended branches

```text
main                 stable/demo-ready
dev                  integration branch
feature/profile      profile work
feature/scanner      scan UX
feature/chat         AI agent UX
feature/report       appointment report
ml/image-router      ML model work
docs/research        documentation/research
```

See `docs/REPO_WORKFLOW.md` for the Mopec-style workflow.
