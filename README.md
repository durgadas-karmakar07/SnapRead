# SnapRead — AI-Driven Website Summariser

SnapRead is a full-stack React + TypeScript web application that fetches the visible text of any public URL on the server and uses the Google Gemini API (`@google/genai` Interactions API) to generate a concise, structured summary.

## Features

- **URL Input & Validation**: Accessible URL input with bare-domain normalization (`example.com` → `https://example.com`), deferred validation (`:user-invalid` + synced `aria-invalid`), and clickable sample URLs.
- **Visible Text Extraction**: Server-side HTML fetcher using `fetch` + `cheerio` that strips scripts, styles, hidden elements, and boilerplate navigation while guarding against SSRF/private IPs and oversized responses.
- **Gemini AI Summarization**: Calls `@google/genai` (`models.generateContent`) with `gemini-3.5-flash-lite` and JSON-schema structured outputs to produce a headline, short summary, key takeaways, topic tags, and estimated reading time.
- **Clean Reading UI**: Editorial light/dark mode (`color-scheme: light dark` + `light-dark()`), semantic `<progress>` loading spinner with cancel support, copy-to-clipboard with live status announcement, session history chips, and an expandable preview of extracted text.

## Folder Structure

```text
SnapRead/
├── index.html                   # App shell with color-scheme meta & semantic root
├── netlify.toml                 # Netlify build, Node 22 runtime, and /api redirects
├── .nvmrc                       # Pins Node 22 for hosting platforms
├── package.json                 # Unified scripts (dev, build, start, typecheck, test)
├── tsconfig.json                # Client TypeScript configuration
├── tsconfig.server.json         # Server TypeScript configuration
├── tsconfig.netlify.json        # Netlify Functions TypeScript check configuration
├── vite.config.ts               # Vite bundler + /api proxy to Express
├── .env.example                 # Environment variable template
├── netlify/functions/
│   ├── health.ts                # Netlify Function for GET /api/health
│   └── summarize.ts             # Netlify Function for POST /api/summarize
├── server/
│   ├── index.ts                 # Express server entrypoint + static serving
│   ├── config.ts                # Runtime configuration and limits
│   ├── routes/summarize.ts      # GET /api/health & POST /api/summarize
│   ├── services/
│   │   ├── fetcher.ts           # SSRF-safe HTTP fetch & visible text extractor
│   │   ├── gemini.ts            # @google/genai client & structured output parser
│   │   └── pipeline.ts          # Shared summarization pipeline for Express & Netlify
│   └── types/summary.ts         # Backend request/response types
├── src/
│   ├── main.tsx                 # React entrypoint
│   ├── App.tsx                  # Main application state & layout
│   ├── index.css                # Design tokens, dark mode, spinner, card styles
│   ├── components/
│   │   ├── Header.tsx           # Brand header & theme toggle
│   │   ├── UrlForm.tsx          # Accessible URL form & quick-try examples
│   │   ├── LoadingCard.tsx      # Indeterminate <progress> spinner + cancel
│   │   ├── ErrorBanner.tsx      # Error card & optional session API key fallback
│   │   ├── SummaryCard.tsx      # Structured summary, takeaways, topics & preview
│   │   └── CopyButton.tsx       # Clipboard button with accessible status region
│   ├── services/api.ts          # Typed frontend fetch client
│   └── types/summary.ts         # Frontend TypeScript interfaces
└── tests/
    ├── fetcher.test.ts          # URL validation & HTML visible-text unit tests
    └── routes.test.ts           # API route & error-handling integration tests
```

## Getting Started

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Configure Gemini API key**

   Copy `.env.example` to `.env` and add your API key from [Google AI Studio](https://aistudio.google.com/apikey):

   ```bash
   cp .env.example .env
   ```

   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   GEMINI_MODEL=gemini-3.5-flash-lite
   PORT=3001
   ```

   *(If `GEMINI_API_KEY` is not set in `.env`, the UI also lets you paste a temporary key for your current browser session.)*

3. **Run in development**

   ```bash
   npm run dev
   ```

   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost:3001` (proxied automatically at `/api`)

4. **Typecheck, test, and production build**

   ```bash
   npm run typecheck
   npm test
   npm run build
   npm start
   ```

## Deploying to Netlify

SnapRead includes `netlify.toml`, `.nvmrc` (Node 22), and serverless Netlify Functions in `netlify/functions/` (`health.ts` and `summarize.ts`) mapped to `/api/health` and `/api/summarize`.

1. Push the full repository (including `src/`, `server/`, `netlify/`, `netlify.toml`, `package.json`, and `index.html` — never `.env`) to GitHub.
2. Connect the repository in Netlify (build command `npm run build`, publish directory `dist`, functions directory `netlify/functions` are auto-detected from `netlify.toml`).
3. In **Netlify → Project configuration → Environment variables**, add:
   - `GEMINI_API_KEY` = your Gemini API key
   - `GEMINI_MODEL` = `gemini-3.5-flash-lite` (optional)
4. Trigger a deploy.
