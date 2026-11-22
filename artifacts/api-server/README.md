# Tarraya server and WhatsApp Sandbox

## Twilio setup

The webhook URL, confirmed from this project's published deployment, is:

**`https://tarraya-link-checker--Hmdlnhdy.replit.app/api/whatsapp`**

In Twilio Console → Messaging → Try it out → Send a WhatsApp message →
Sandbox settings, set **When a message comes in** to that URL, method **POST**.
Join the Sandbox from each tester's WhatsApp using the join code shown by Twilio.
The sender must remain a joined Sandbox participant. Twilio's Sandbox/session
restrictions and messaging charges apply.

Add these exact keys in **Replit Secrets**, never source control or chat:

| Secret | Value to enter |
| --- | --- |
| `TWILIO_ACCOUNT_SID` | The `AC…` Account SID for the Sandbox's Twilio account |
| `TWILIO_AUTH_TOKEN` | That account's Auth Token; **not** an API Key Secret. Used by the official SDK for signature validation and outbound messages |
| `TWILIO_WHATSAPP_FROM` | The Sandbox sender shown in Twilio, including `whatsapp:` and the `+` country code |

Common phone formatting (spaces, parentheses and hyphens) is normalized.
An international number without `whatsapp:` or `+` is also accepted and given
the canonical prefix; a missing country code is never guessed.

The connected Twilio integration currently supports reads but not form-encoded
outbound message creation. The official `twilio` SDK therefore uses Secrets for
sends and signature validation. Credentials must all belong to the same account.

This non-secret shared environment variable has already been configured:

```text
TWILIO_WEBHOOK_URL=https://tarraya-link-checker--Hmdlnhdy.replit.app/api/whatsapp
```

It must match the Twilio URL exactly: HTTPS, case, hostname and path, with **no
trailing slash or query string**. Validation uses this fixed external URL and all
received form fields, not the proxy's internal HTTP URL, Host or forwarded headers.
If the published domain changes, update this variable and Twilio together.
There is no unsigned development bypass.

### Deployment requirement

The current published deployment is **Autoscale**, which can stop when idle.
The durable queue is processed by a polling worker inside the API server.
**Run this API on an always-on Reserved VM before relying on asynchronous
WhatsApp delivery.** Autoscale can acknowledge a message then suspend its
background worker; queued jobs resume when the server next runs, but prompt
delivery cannot be guaranteed. Hosting has not been changed automatically.
Review the hosting cost in Publishing settings before changing deployment type.

Publish the new code and the additive `whatsapp_jobs` database schema before
pointing Twilio at the webhook. Ensure the three Secrets and the URL variable
are included in the published environment. The public deployment is reachable
without Replit authentication; webhook access is protected by Twilio signatures.
Do not use the private workspace `.replit.dev` preview URL in Twilio.

For development schema setup:

```sh
pnpm --filter @workspace/db run push
```

## Behaviour and reliability

- The endpoint accepts `application/x-www-form-urlencoded`, verifies the official
  SDK signature before processing, then checks AccountSid and Sandbox recipient.
- Arabic/Gulf Arabic text receives Arabic replies; Latin/English text receives
  English replies. A link-only message defaults to Arabic.
- No URL asks for one HTTP(S) link. Multiple distinct URLs ask the sender to submit
  one at a time. Repeating the same URL is treated as one link. Unsupported schemes
  and malformed URLs get clear guidance. Bare hostnames need an HTTP(S) prefix.
- Valid single links are saved durably and immediately acknowledged with TwiML.
  AI never runs on the webhook's response path. Queue acceptance has a four-second
  application deadline; a queue failure returns 503 for retry. Keep the database
  and always-on server healthy: cold starts/network failure remain external limits.
- The worker calls the **same `analyzeLink` function as the website** and sends a
  separate WhatsApp message with assessment, domain evidence, AI reasons/limitation,
  safe next step, and the directory source when available. Submitted sites are
  never fetched; the submitted link is not echoed as a tappable WhatsApp link.
- `MessageSid` is a PostgreSQL primary key, not an in-memory cache. Duplicate
  webhooks return empty TwiML without analysis or another reply. Identifier-only
  receipts remain indefinitely to prevent replay after payload cleanup.
- At most five accepted analyses per sender per minute are queued. Quota keys are
  HMACs, not raw phone numbers, and are removed after their one-minute quota window.
  Database row locking prevents concurrent workers
  from claiming the same job. Analysis interrupted by a crash can be retried
  after a two-minute stale-job lease; completed analysis is saved before sending.
- A result send has an eight-second SDK timeout and automatic retries disabled.
  If a send times out or the process dies after submitting it, delivery can be
  ambiguous. Mark it `delivery_unknown`, check Twilio Messaging logs, and do not
  automatically resend: Twilio message creation offers no exactly-once guarantee.
  `sent` here means Twilio accepted the API request, not confirmed handset delivery.
- Message text and submitted URL are stored only for pending analysis, removed
  when its reply is prepared, and expired after 24 hours if not processed.
  Sender/recipient and reply are removed after send/uncertain delivery. Cleanup
  runs while the worker runs; no cleanup happens while the deployment is stopped.
  No raw messages, phone numbers, SDK errors, tokens or signatures are logged.
- Nonempty messages use the already-enabled OpenAI integration and incur token
  charges. WhatsApp messages also incur Twilio charges according to your account.

## Tests

```sh
pnpm --filter @workspace/api-server run test:whatsapp
pnpm --filter @workspace/api-server run typecheck
```

Tests use synthetic signed form requests and reserved `.example` URLs, a mocked
AI/send worker (including slow analysis and ambiguous delivery), and isolated
temporary schema in the development database for persistent deduplication/quota
checks. They never call Twilio's send API or consume AI tokens.
The live worker cannot see the isolated test queue, even when real credentials
are configured.

Real Sandbox delivery still requires Secrets, publishing, and a joined tester.

## Official organisation directory

Edit `src/data/official-domains.json`. Each verified record contains organisation
name, category, exact verified hostname, official source URL and verification date
(`YYYY-MM-DD`). Add aliases only for organisation identification. Separately
verify each hostname; parent/sibling/subdomains are not automatically trusted.
Keep fictional `.example` records out of this verified directory. See
`src/data/README.md` for the directory's matching rules and examples.
