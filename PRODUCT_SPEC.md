# Honeycomb Product Spec

## Product idea
Honeycomb is a **personalized exposure intelligence system**. It helps a user organize known and suspected triggers, scan everyday exposures, keep context over time, and prepare better information for clinical appointments.

## Main experience

### 1. Honeycomb Profile
The profile should distinguish:
- confirmed / known allergies
- suspected triggers
- personal avoid list
- tolerated / known-good exposures
- background synopsis
- uploaded-record references
- reaction history
- prior scans
- saved AI chats

Keeping these categories separate is important. A suspicion should never silently become a “confirmed allergy.”

### 2. Scan almost anything
Future scan types:
- ingredient lists
- packaged food
- plates of food
- restaurant menus
- cosmetics / skincare / soap / lotion
- fabric labels and materials
- plants / trees / flowers
- animals / environmental exposures
- visible flare-ups
- barcodes / product fronts

### 3. Explainable result
Every result should answer:
1. What did Honeycomb recognize?
2. What did it compare against?
3. What matched the user's profile/history?
4. What information is missing?
5. How strong is the evidence?
6. What should the user consider doing next?

Use outcomes such as:
- Potential concern
- Needs review
- No profile match found
- Unable to verify
- Previously tolerated match

Avoid a binary “safe / unsafe.”

### 4. Honeycomb Signal
The confidence number is **evidence confidence**, not a probability that the user is allergic.

Example:
- 85% evidence confidence = Honeycomb has strong matching evidence for the explanation it is showing.
- 20% evidence confidence = Honeycomb does not have enough reliable information.

### 5. Reaction Journal
Log:
- date/time
- photo
- user description
- severity for personal tracking
- recent exposures
- notes
- related scans

Future versions can look for patterns between exposures and reactions without declaring causation.

### 6. AI Agent
The AI agent should:
- use selected profile context
- remember saved threads
- reference scan history and reaction history
- retrieve approved medical/product information
- explain uncertainty
- help prepare questions for appointments

A production version should use retrieval/structured memory rather than training a brand-new LLM for every user.

### 7. Appointment Snapshot
One button should create a current report containing:
- profile synopsis
- confirmed vs suspected items
- personal avoid list
- tolerated exposures
- recent scans
- reaction timeline
- record list
- patterns worth discussing
- user questions

## What makes Honeycomb different
- Not just an ingredient checker
- Not limited to food
- Not limited to cosmetics
- Personal context is first-class
- Tracks tolerated exposures too
- Shows uncertainty instead of pretending certainty
- Designed around “what touches my world?”
- Appointment report turns scattered daily experiences into something usable
