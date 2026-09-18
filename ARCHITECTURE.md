# Honeycomb Architecture

```text
                     ┌─────────────────────┐
                     │  Honeycomb Profile  │
                     │ known / suspected   │
                     │ avoid / tolerated   │
                     │ history / records   │
                     └──────────┬──────────┘
                                │
                                ▼
┌─────────────┐       ┌─────────────────────┐
│ Camera/File │──────▶│  Image Router ML    │
└─────────────┘       │ "what is this?"     │
                      └──────────┬──────────┘
                                 │
          ┌──────────────┬───────┼───────────┬──────────────┐
          ▼              ▼       ▼           ▼              ▼
   ingredient OCR     food      fabric      nature        flare-up
       / product      flow       flow        flow          journal
          └──────────────┴───────┴───────────┴──────────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Evidence Engine     │
                      │ matches + sources   │
                      │ uncertainty         │
                      └──────────┬──────────┘
                                 │
                                 ▼
                      ┌─────────────────────┐
                      │ Honeycomb Signal    │
                      │ explanation + score │
                      └──────────┬──────────┘
                                 │
                  ┌──────────────┴───────────────┐
                  ▼                              ▼
           Reaction Journal                 AI Agent
                  │                              │
                  └──────────────┬───────────────┘
                                 ▼
                      Appointment Snapshot
```

## Prototype
Static PWA + browser localStorage.

## Production
A real health-data product would need:
- secure authentication
- encrypted database
- encrypted document/image storage
- explicit consent controls
- server-side AI calls
- audit logging
- source/version tracking
- deletion/export controls
- clinical-safety review
- privacy/legal review appropriate to the data handled

GitHub Pages is for the public demo only, not private medical-record storage.
