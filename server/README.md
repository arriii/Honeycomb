# Honeycomb Brain

Secure backend for Honeycomb V2.

## What it does

`POST /api/analyze-scan` accepts:
- a base64 camera image
- scan mode
- the user's Honeycomb profile
- recent scans
- recent reactions
- recent Honey chat context

The backend then sends the image and context to the OpenAI Responses API with image input and the built-in web search tool. It returns a structured product/exposure analysis plus real web-search sources.

## Safety / privacy choices

- The OpenAI API key stays on the server and is never shipped to the browser.
- Requests use `store: false`.
- The server does not persist images, profiles, reactions, or chat.
- Logs intentionally avoid printing user payloads.
- CORS is limited to the Honeycomb preview origin and localhost by default.
- There is a basic per-IP rate limit.
- Skin/image observations are explicitly non-diagnostic.
- "No identified conflict" requires stronger evidence than readable package text alone.

## Environment variables

Copy `.env.example` to `.env` locally and set:

- `OPENAI_API_KEY` — required
- `OPENAI_MODEL` — defaults to `gpt-5.6-terra`
- `PORT` — defaults to `10000`
- `HONEYCOMB_ALLOWED_ORIGINS` — comma-separated allowed origins

Never commit the real `.env` file or an API key.

## Local run

```bash
cd server
npm install
npm start
```

Then test:

```text
GET http://localhost:10000/health
```

## Deploy

The repository includes a root `render.yaml` Blueprint. On Render, connect this repo/branch and add the `OPENAI_API_KEY` secret. After deployment, put the service URL in `config.js`.
