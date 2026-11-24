# Tarraya / تريّا

**An Arabic-first, mobile-friendly link and message checker that helps people pause before opening a suspicious link.**

## Submission status

**The web checker is the hackathon demo.** It includes Arabic RTL and English,
live text-only URL checks, structured message analysis when the configured AI
integration is available, and three clearly labelled fictional demonstrations.
No account creation is required.

**WhatsApp is an experimental integration, not the confirmed demo:** Twilio
inbound webhook requests reached the app, but live WhatsApp replies were not
confirmed. The production sender is pending Meta business verification.
Successful HTTP responses or earlier Twilio message records are not evidence
that this application's live reply journey worked end to end.

## Problem and solution

Fraudulent messages can imitate a bank or delivery company, create urgency, and
ask for payment or secret information. A familiar-looking domain is not enough
to establish that a message is trustworthy.

Tarraya accepts a link and optional surrounding message. It parses the URL
without visiting the site, checks local warning signs, compares the **exact
hostname** with a small documented organisation directory, and returns evidence
and a practical safe next step. Optional AI explains message-language signals;
it does not certify sites or invent official contact information.

The interface uses navy `#102437` and mint `#78E2C1`, large controls, Arabic by
default, and an English switch.

## Architecture

```text
React web interface
  ├─ three fictional .example demonstrations (local UI state, no API call)
  └─ POST /api/check
       └─ shared analyzeLink()
            ├─ URL parser + tldts + deterministic warning rules
            ├─ exact-host organisation-directory lookup
            └─ optional server-side OpenAI analysis → schema/quote validation

Experimental POST /api/whatsapp
  └─ Twilio signature + form validation + MessageSid deduplication
       ├─ inline TwiML prompt when no link is supplied
       └─ PostgreSQL queue → same analyzeLink() → Twilio outbound API
```

Replit's artifact router normally serves the frontend at `/` and Express at
`/api`. For a fresh clone outside Replit, `SERVE_WEB=1` makes Express serve the
built frontend and API together. No extra reverse proxy is needed for that mode.
The optional static-serving mode does not change Replit's normal routing.

### Technologies and APIs actually used

| Area | Used by this MVP |
| --- | --- |
| Interface | React 19, TypeScript, Vite 7, Tailwind CSS 4, Lucide icons |
| API client | Generated React Query hooks with TanStack Query |
| Server | Node.js, Express 5, Pino logging, express-rate-limit |
| URL analysis | Native `URL` parser, Node IP-address checks, public-suffix-aware `tldts` |
| Contracts | OpenAPI 3.1, Orval code generation, Zod validation |
| Message AI | OpenAI SDK through Replit AI Integrations; configured model `gpt-5.6-terra`, Chat Completions with JSON Schema output |
| WhatsApp experiment | Official `twilio` Node SDK, signed form webhook, TwiML, Programmable Messaging outbound API |
| Queue and persistence | PostgreSQL, `pg`, Drizzle ORM/schema tooling |
| Tooling | pnpm workspace, esbuild server bundle, Node test runner through `tsx` |

The installed workspace contains starter UI components, an unused mockup sandbox,
and additional AI helper modules. They are included as source but are not
additional features of the submitted MVP. There is no browser automation,
malware scanner, reputation-feed API, DNS/WHOIS lookup or page downloader in the
link-checking flow.

### Relevant source

```text
artifacts/tarraya/                      Web checker and labelled demonstrations
artifacts/api-server/src/routes/        /check, /whatsapp, /healthz
artifacts/api-server/src/lib/           Shared analysis, AI validation, queue worker
artifacts/api-server/src/data/          Official directory and matching rules
artifacts/api-server/tests/             Synthetic webhook/queue regression tests
lib/api-spec/openapi.yaml               API source of truth
lib/api-zod/                           Generated server schemas
lib/api-client-react/                  Generated client hooks
lib/db/src/schema/                     WhatsApp queue schema
lib/integrations-openai-ai-server/      Server-only managed OpenAI client
```

## Data sources and domain decisions

The live directory is
[`artifacts/api-server/src/data/official-domains.json`](artifacts/api-server/src/data/official-domains.json).
It contains organisation name, category, hostname, official source URL and
verification date. These four records were supplied for this project with the
recorded verification date **2026-11-23**:

| Organisation | Exact listed hostname | Recorded official source |
| --- | --- | --- |
| First Abu Dhabi Bank (FAB) | `www.bankfab.com` | [FAB personal banking](https://www.bankfab.com/en-ae/personal) |
| Emirates NBD | `www.emiratesnbd.com` | [Emirates NBD](https://www.emiratesnbd.com/en) |
| Aramex | `www.aramex.com` | [Aramex tracking](https://www.aramex.com/ae/en/track/shipments) |
| Emirates Post | `www.emiratespost.ae` | [Emirates Post tracking](https://www.emiratespost.ae/all-services/track-a-package) |

The recorded date is directory metadata, not proof of continuous or automated
verification. No source page is fetched during a check. The directory is not a
complete bank, courier or government registry.

To update it, independently verify an organisation's exact hostname, then edit
the JSON and record its official source and verification date. Do not add parent
domains, sibling hosts or subdomains unless separately verified. See the
[directory instructions](artifacts/api-server/src/data/README.md).

The server must identify exactly one listed organisation in the message before
comparing the hostname with that organisation's entry. Public-suffix parsing
provides domain context; it does **not** broaden the exact-host allowlist. An
unknown or unidentified organisation/domain remains unverified. Even an exact
match is not an “entirely safe” verdict.

The three UI demonstration records are fictional, use reserved `.example`
domains, and stay separate from the verified directory. Their canned results are
labelled as demonstrations, not server analysis.

## Privacy and security design

- The checker does **not** open, download, resolve redirects from, or execute a
  submitted website. HTTP(S) URL text is parsed locally on the server.
- Submitted links are plain text in web results, not clickable anchors. Verified
  directory source links are separate and may be opened deliberately.
- No accounts are required. Web checks do not intentionally persist submitted
  links or messages in the application database.
- A nonempty optional message is sent to OpenAI through Replit, along with the
  parsed hostname and selected server directory findings. A URL pasted inside
  that message is part of the transmitted text. Do not submit real secrets,
  personal identifiers, passwords or OTPs. A link-only check makes no AI call.
- Provider processing/retention policies still apply. “Not stored in our web
  database” does **not** mean zero retention by Replit, OpenAI, Twilio, networks
  or browsers.
- AI input is explicitly treated as untrusted data, not instructions. Output
  must match JSON Schema and strict Zod validation; quoted evidence and claimed
  organisation names must occur in the input. Unsupported domain/phone/fact
  claims are filtered. These safeguards reduce errors, not eliminate them.
- If AI is unavailable or invalid, domain findings remain available and the
  interface explains the limitation. No hidden “safe” fallback is returned.
- `/api/check` limits request frequency (20 per minute per process/IP), message
  length (2,000 characters) and request body size (16 KB).
- Logs omit bodies, raw submitted messages, phone numbers and credentials.
  Webhook logs record response type; outbound failures log only allowlisted
  numeric Twilio error codes and HTTP status, never SDK error objects.
- Experimental WhatsApp queues do store message/URL and routing numbers while
  work is pending. Message/URL are removed when a result is prepared; routing
  numbers and reply are removed after sending or uncertain delivery. Pending
  payloads expire after 24 hours **while the worker is running**. Identifier-only
  MessageSid receipts remain for deduplication. Quota keys use an HMAC.
- Twilio signatures are checked with its official SDK against the configured
  published HTTPS URL. There is no unsigned development bypass.

## Trade-offs and limitations

- This is a decision-support MVP, not an antivirus, fraud guarantee, or
  endorsement by the organisations in the directory.
- Not fetching pages avoids exposure to hostile sites and server-side request
  forgery through submitted links, but misses page content, redirects, malicious
  downloads and newly compromised legitimate sites.
- The small, manually maintained exact-host directory favours precision over
  coverage. Legitimate unlisted hosts remain unverified.
- Directory organisation identification uses local name/alias rules. The AI can
  identify a claimed name but does not add directory records or override the
  server's domain finding. Multiple/ambiguous organisation names can produce
  insufficient information.
- AI language coverage targets Arabic, Gulf Arabic and English; accuracy has
  not been measured on a representative dataset. Results can be wrong or
  inconclusive. Model availability, network latency and usage charges apply.
- Managed Replit AI credentials are not included in a clone. The selected model
  is not promised to be available through a personal OpenAI API account.
- PostgreSQL is currently required at API startup even for a web-only run,
  because the experimental WhatsApp router imports the queue database package.
- Per-process web rate limits are not a distributed abuse-control system.
- Background WhatsApp work requires always-on hosting for dependable progress.
  Autoscale can pause after an acknowledgement. Ambiguous outbound sends are
  not automatically retried, to avoid duplicate replies. Twilio accepting a
  send does not prove handset delivery.
- Inbound WhatsApp requests reached the app; live reply delivery is unconfirmed.
  The production sender is pending Meta business verification. Do not present
  WhatsApp as working end-to-end in the hackathon demonstration.

## Fresh-clone build and run

### Prerequisites

- **Linux x64**, or an equivalent Linux x64 environment. The workspace currently
  excludes many other platform-specific build binaries in its pnpm overrides;
  native macOS/Windows/ARM installs are not claimed as supported.
- **Node.js 24** and **pnpm 10.26.1**. If pnpm is not installed:
  `npm install --global pnpm@10.26.1`.
- An existing PostgreSQL database that you control. Create a dedicated empty
  database named `tarraya` with your PostgreSQL administration tools and give
  your application role permission to create tables.
- Optional: Replit-managed OpenAI integration for AI message analysis. Twilio
  credentials are **not required** for the web demo.

### Build and start on one local port

Run these commands in Bash from a fresh clone. Replace the GitHub placeholder
with the repository you created:

```bash
git clone https://github.com/YOUR_GITHUB_USERNAME/tarraya.git
cd tarraya
pnpm install --frozen-lockfile
cp .env.example .env
```

Edit `.env` locally: replace `DATABASE_URL` with your own database connection
string. Keep the optional AI and Twilio fields empty for a no-credentials demo.
Never commit this file. Then:

```bash
# Export the local configuration into this shell and child processes.
# .env.example uses Bash-compatible KEY=value syntax; quote values if needed.
set -a
source .env
set +a

# Create the queue schema in your dedicated database (not an unknown production DB).
pnpm --filter @workspace/db run push

# Build shared types, check the two MVP packages, then build their runnable output.
pnpm run typecheck:libs
pnpm --filter @workspace/api-server run typecheck
pnpm --filter @workspace/tarraya run typecheck
pnpm --filter @workspace/api-server run build
PORT=8080 BASE_PATH=/ NODE_ENV=production pnpm --filter @workspace/tarraya run build

# Starts both the built UI and API at http://localhost:8080.
SERVE_WEB=1 PORT=8080 NODE_ENV=production pnpm --filter @workspace/api-server run start
```

Open **http://localhost:8080**. A URL-only check works without AI credentials.
Submitting message text without configured AI returns explicit AI-unavailable
status plus the deterministic domain/rule findings.

The application does not automatically load `.env`; source it as shown.
After editing source, rerun the relevant build commands and restart the server.
Generated `dist/`, local `.env`, logs and dependencies are not submission source.

### Replit development

Use Replit Secrets for `DATABASE_URL` and any provider credentials; do not
overwrite managed credentials by sourcing a blank local `.env`. Configure the
managed OpenAI integration if using AI. Run the two existing workflows, whose
commands are:

```bash
pnpm --filter @workspace/api-server run dev
pnpm --filter @workspace/tarraya run dev
```

Replit supplies each service's distinct `PORT` and `BASE_PATH`, and its router
forwards `/api` to Express. Leave `SERVE_WEB` unset in this mode. Running these
commands in two ordinary local shells without that router is **not** the
documented fresh-clone setup; use the single-server build above instead.

If the OpenAPI contract changes, regenerate the checked-in clients/schemas:

```bash
pnpm --filter @workspace/api-spec run codegen
```

## Fictional demo and how to test

### Recommended judge demonstration

1. Open the web checker and switch between Arabic RTL and English.
2. Select **A link with warning signs** from the demonstration section:
   - URL: `https://account-urgent-login.example/verify`
   - Fictional text: `Act now to keep your account. Confirm your password immediately.`
3. Show the **DEMONSTRATION ONLY** label, reasons and safe next step.
4. Use the other example buttons for a **fictional directory match** and
   **insufficient information**. The fictional match is not a real organisation
   verification and never adds a `.example` host to the live directory.
5. Choose “check another link.” For a real server request using fictional data,
   submit `https://notice.example/` with the message field empty. It should show
   insufficient/unverified information, the reserved-domain evidence, and a safe
   next step—not a guarantee of safety. This step requires neither AI nor Twilio.

### API smoke tests

With the standalone server running, use another terminal:

```bash
curl -fsS http://localhost:8080/api/healthz

curl -fsS http://localhost:8080/api/check \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://notice.example/","language":"en"}'

# Synthetic warning text only. With configured AI, this incurs token usage.
# Without AI credentials, the deterministic warnings still appear.
curl -fsS http://localhost:8080/api/check \
  -H 'Content-Type: application/json' \
  -d '{"url":"https://account-urgent-login.example/verify","message":"Act now. Confirm your password immediately.","language":"en"}'

# Expected: 400, since only HTTP(S) links are accepted.
curl -i http://localhost:8080/api/check \
  -H 'Content-Type: application/json' \
  -d '{"url":"ftp://notice.example/","language":"en"}'

# Expected: 403 without a signature if WhatsApp is configured;
# 503 if the optional WhatsApp integration is not configured.
curl -i http://localhost:8080/api/whatsapp \
  -H 'Content-Type: application/x-www-form-urlencoded' \
  --data-urlencode 'Body=Hello'
```

### Automated tests

Use the same exported `.env` and dedicated development database:

```bash
pnpm --filter @workspace/api-server run test:whatsapp
```

The test suite covers signed webhook requests, the exact XML “Hello” prompt,
duplicate protection, URL counts, language selection, slow analysis,
AI-unavailable guidance, numeric-only error diagnostics and persistent queue
limits. It uses synthetic credentials, reserved `.example` URLs, mocked AI/send
functions and an isolated temporary PostgreSQL schema. The database role must
be able to create and drop that temporary schema. Tests make **no** Twilio send
API calls and consume **no** AI tokens. These tests do not establish real
WhatsApp delivery. Frontend-demo checks above are manual, not automated browser
coverage.

## Optional WhatsApp configuration

Details are in [the API README](artifacts/api-server/README.md). The server reads:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_WHATSAPP_FROM`
- `TWILIO_WEBHOOK_URL` — exact public HTTPS URL ending in `/api/whatsapp`

Store credentials only in Secrets or your ignored local environment. The
connected Twilio integration supported reads, not outbound form posts; the
implemented outbound path therefore uses the official SDK with server-only
credentials. No Twilio credentials or working sender account are distributed
with this submission.

## Source completeness and Git hygiene

The MVP frontend, Express routes, shared analyzer, directory, AI integration
client, WhatsApp queue/worker, database schema, generated API contracts, tests,
build files and pnpm lockfile are included. Dependencies are restored with pnpm;
generated bundles, a database dump, personal messages and provider accounts are
not necessary source and are not included.

`.gitignore` excludes `.env` variants (except `.env.example`), logs, private-key
files, database dumps, local dependencies, build output and generated checks.
`.replitignore` also excludes local secrets/logs from published file bundles.
The template contains placeholders only.

The submission check found no tracked `.env`/log/private-key/database-dump
filenames and no high-confidence provider keys, private-key blocks or credential
connection strings in the inspected tracked working-tree files. Historical
filenames were also checked. This is **not** a guarantee that every historical
Git object is free of secrets. Review staged changes and your history before
pushing; if a real credential was ever committed, rotate it and clean history
before sharing. Adding an ignore rule does not remove previously committed data.

## Push to GitHub on `master` yourself

No repository is created, pushed, published or made public by these instructions.
Choose the visibility yourself in GitHub.

1. In GitHub, create an **empty** repository named `tarraya` using your preferred
   visibility. Do not initialise it with a README, licence or `.gitignore`.
2. From this project's repository root, check the current state:

   ```bash
   git status --short
   git branch --show-current
   git remote
   ```

3. This project was on `main` when inspected. Create `master` at the current
   source without rewriting history:

   ```bash
   git switch -c master
   ```

   If `master` already exists, inspect it first and use `git switch master`
   instead; do not overwrite an existing branch blindly.

4. Stage and review all intended source. Confirm `.env` is ignored and the safe
   example is not:

   ```bash
   git check-ignore .env
   git add .
   git diff --cached --name-only
   git diff --cached --stat
   git diff --cached
   git commit -m "Prepare Tarraya hackathon submission"
   ```

   Do not commit if you see credentials, real messages, private contact details
   or logs. If there is nothing to commit, continue with the existing commit.

5. Add **your** empty GitHub repository as `origin`:

   ```bash
   git remote add origin https://github.com/YOUR_GITHUB_USERNAME/tarraya.git
   git push -u origin master
   ```

   Use GitHub's credential manager/browser authentication or SSH, not a token
   embedded in the URL. The inspected project had no `origin` remote. If you
   already added one, verify it and use `git remote set-url origin YOUR_REPO_URL`
   only if you deliberately want to replace it. Leave unrelated backup remotes
   alone. Do not force-push.

6. If needed, choose `master` as the default branch in your GitHub repository
   settings. Recheck the chosen visibility yourself and share the repository
   and web-demo link with the judges. A GitHub push does not publish the Replit
   app or change its deployment.
