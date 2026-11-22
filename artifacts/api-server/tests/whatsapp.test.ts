import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { after, test } from "node:test";
import { once } from "node:events";
import express from "express";
import twilio from "twilio";
import { pool } from "@workspace/db";
import type { LinkCheckResult } from "@workspace/api-zod";
import { createWhatsappRouter } from "../src/routes/whatsapp";
import { createWhatsappStore, type JobPayload } from "../src/lib/whatsapp-store";
import { createWhatsappProcessor } from "../src/lib/whatsapp-worker";
import { analyzeDomainLink } from "../src/lib/link-analysis";
import { extractUrls, formatWhatsappResult, messageLanguage } from "../src/lib/whatsapp-message";

// Synthetic credentials are used only to sign local test requests. No Twilio or AI calls.
const config = {
  accountSid: `AC${"1".repeat(32)}`, authToken: "synthetic-test-token-not-a-credential",
  from: "whatsapp:+15550000000",
  webhookUrl: "https://published.example/api/whatsapp",
};
const sid = () => `SM${randomBytes(16).toString("hex")}`;
const fields = (Body: string) => ({
  MessageSid: sid(), AccountSid: config.accountSid, From: "whatsapp:+15550000001",
  To: config.from, Body, UnexpectedFutureField: "included-in-signature",
});
const payload: JobPayload = {
  url: "https://notice.example/", message: "FAB says pay today https://notice.example/",
  language: "en", from: "whatsapp:+15550000001", to: config.from,
};
const fixture = (language: "ar" | "en" = "en"): LinkCheckResult => ({
  ...analyzeDomainLink({ url: payload.url, message: payload.message, language }),
  aiAnalysis: { status: "unavailable", claimedOrganisation: null, signals: [],
    message: language === "ar" ? "تحليل الذكاء الاصطناعي غير متاح. نتائج النطاق معروضة." : "AI analysis is unavailable. Domain findings are still shown." },
});

test("URL extraction and language handle punctuation, duplicates, Arabic and English", () => {
  assert.deepEqual(extractUrls("افحص (https://one.example/)، https://two.example/."), ["https://one.example/", "https://two.example/"]);
  assert.deepEqual(extractUrls("https://one.example/ https://one.example/"), ["https://one.example/"]);
  assert.equal(messageLanguage("افحص FAB https://notice.example/"), "ar");
  assert.equal(messageLanguage("Please check https://notice.example/"), "en");
  assert.equal(messageLanguage("https://notice.example/"), "ar");
});

test("signed webhooks use canonical HTTPS, reject tampering, acknowledge once and handle URL counts", async () => {
  const seen = new Set<string>();
  const queued: JobPayload[] = [];
  let wakes = 0;
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.use("/api", createWhatsappRouter({
    config: () => config,
    store: { async accept(id, job) {
      if (seen.has(id)) return "duplicate";
      seen.add(id);
      if (job) queued.push(job);
      return "accepted";
    } },
    wake: () => { wakes++; },
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const endpoint = `http://127.0.0.1:${address.port}/api/whatsapp`;
  async function post(data: ReturnType<typeof fields>, signedUrl = config.webhookUrl, suffix = "") {
    return fetch(endpoint + suffix, { method: "POST", headers: {
      "content-type": "application/x-www-form-urlencoded",
      "x-twilio-signature": twilio.getExpectedTwilioSignature(config.authToken, signedUrl, data),
      // Forging proxy headers cannot change signature verification.
      "x-forwarded-proto": "http", "x-forwarded-host": "attacker.example",
    }, body: new URLSearchParams(data), signal: AbortSignal.timeout(6000) });
  }
  try {
    const input = fields("FAB: pay today https://notice.example/");
    const started = Date.now();
    const accepted = await post(input);
    assert.equal(accepted.status, 200);
    assert.match(accepted.headers.get("content-type")!, /xml/);
    assert.match(await accepted.text(), /Link received/);
    assert.ok(Date.now() - started < 2000);
    await new Promise((resolve) => setImmediate(resolve));
    assert.equal(queued.length, 1);
    assert.equal(queued[0].url, payload.url);
    assert.equal(queued[0].message, input.Body);
    assert.equal(wakes, 1);
    const duplicate = await post(input);
    assert.doesNotMatch(await duplicate.text(), /<Message>/);
    assert.equal(queued.length, 1);
    assert.equal((await post(fields("https://notice.example/"), "http://published.example/api/whatsapp")).status, 403);
    assert.equal((await post(fields("https://notice.example/"), config.webhookUrl, "?fake=1")).status, 403);
    const modified = fields("https://notice.example/");
    modified.AccountSid = `AC${"2".repeat(32)}`;
    assert.equal((await post(modified)).status, 403);
    assert.match(await (await post(fields("مرحبا"))).text(), /أرسل رابطاً/);
    assert.match(await (await post(fields("Two links https://one.example/ https://two.example/"))).text(), /More than one link/);
    assert.match(await (await post(fields("افحص ftp://notice.example/"))).text(), /رابطاً صالحاً/);
    assert.match(await (await post(fields("Check https://[")) ).text(), /could not be parsed/);
    assert.equal(queued.length, 1);
    const badSignature = await fetch(endpoint, {method: "POST", headers: {"content-type":"application/x-www-form-urlencoded","x-twilio-signature":"bad"}, body:new URLSearchParams(input)});
    assert.equal(badSignature.status, 403);
    assert.equal((await fetch(endpoint, {method:"POST",headers:{"content-type":"application/json"},body:"{}"})).status, 415);
  } finally {
    server.close();
    server.closeAllConnections();
  }
});

test("worker waits for slow analysis, preserves domain findings if AI is unavailable, and sends only once", async () => {
  const jobSid = sid();
  let claimed = false;
  let reply: string | undefined;
  let ready = false;
  let sendCount = 0;
  let finishState = "";
  let release!: () => void;
  const slow = new Promise<void>((resolve) => { release = resolve; });
  const processor = createWhatsappProcessor({
    config: () => config, recoverJobs: async () => {},
    claimAnalysis: async () => { if (claimed) return undefined; claimed = true; return {sid:jobSid, payload}; },
    analyze: async () => { await slow; return fixture(); },
    saveReply: async (_id, value) => { reply = value; ready = true; },
    claimDelivery: async () => { if (!ready) return undefined; ready = false; return {sid:jobSid,payload,reply:reply!}; },
    send: async () => { sendCount++; },
    finishDelivery: async (_id, state) => { finishState = state; },
  });
  const running = processor();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(sendCount, 0);
  await processor(); // A concurrent wake must not process the same job.
  release();
  await running;
  await processor();
  assert.equal(sendCount, 1);
  assert.equal(finishState, "sent");
  assert.match(reply!, /hostname isn't listed/);
  assert.match(reply!, /AI analysis is unavailable/);
  assert.match(reply!, /Safe next step/);
  assert.match(reply!, /bankfab.com\/en-ae\/personal/);
  assert.doesNotMatch(reply!, /https:\/\/notice.example/);
  assert.ok(reply!.length <= 1600);
  const arabic = formatWhatsappResult(fixture("ar"));
  assert.match(arabic, /الخطوة الآمنة التالية/);
  assert.match(arabic, /غير متاح/);
});

test("ambiguous outbound failures are recorded without automatic resend", async () => {
  let pending = true;
  let sends = 0;
  let state = "";
  const processor = createWhatsappProcessor({
    config: () => config, recoverJobs: async () => {}, claimAnalysis: async () => undefined,
    claimDelivery: async () => { if (!pending) return undefined; pending=false; return {sid:sid(),payload,reply:"Synthetic result"}; },
    send: async () => { sends++; throw new Error("synthetic timeout"); },
    finishDelivery: async (_id, result) => { state = result; },
  });
  await processor();
  await processor();
  assert.equal(sends, 1);
  assert.equal(state, "delivery_unknown");
});

test("analysis failures produce localized safe guidance rather than losing the reply", async () => {
  let reply = "";
  const processor = createWhatsappProcessor({
    config: () => config, recoverJobs: async () => {},
    claimAnalysis: async () => ({sid:sid(),payload:{...payload,language:"ar"}}),
    analyze: async () => { throw new Error("synthetic service outage"); },
    saveReply: async (_sid, value) => { reply = value; },
    claimDelivery: async () => undefined,
  });
  await processor();
  assert.match(reply, /تعذّر إكمال الفحص/);
  assert.match(reply, /قناة رسمية/);
});

test("long AI explanations preserve the safe next step and directory source within message limits", () => {
  for (const language of ["ar", "en"] as const) {
    const result = fixture(language);
    result.aiAnalysis.message = "x".repeat(400);
    result.aiAnalysis.signals = ["payment_request", "urgency", "sensitive_information"].map((kind) => ({
      kind: kind as "payment_request" | "urgency" | "sensitive_information", excerpt:"test", explanation:"x".repeat(400),
    }));
    const reply = formatWhatsappResult(result);
    assert.ok(reply.length <= 1600);
    assert.ok(reply.includes(result.nextStep.instruction));
    assert.ok(reply.includes(result.directoryCheck.organisation!.sourceUrl));
  }
});

test("PostgreSQL persists duplicate receipts and atomically enforces per-sender limits", async () => {
  // Keep test jobs outside public.whatsapp_jobs: a concurrently running server
  // with real credentials must never pick up synthetic tests for AI or delivery.
  const schema = `whatsapp_test_${randomBytes(8).toString("hex")}`;
  await pool.query(`CREATE SCHEMA "${schema}"`);
  await pool.query(`CREATE TABLE "${schema}".whatsapp_jobs (LIKE public.whatsapp_jobs INCLUDING ALL)`);
  const connect = async () => {
    const client = await pool.connect();
    await client.query(`SET search_path TO "${schema}"`);
    const release = client.release.bind(client);
    // Discard this connection so its test-only search_path cannot leak.
    client.release = () => release(true);
    return client;
  };
  const store = createWhatsappStore(() => config.authToken, connect);
  const ids: string[] = [];
  try {
    const receipt = sid(); ids.push(receipt);
    const responses = await Promise.all(Array.from({length:6}, () => store.accept(receipt, null)));
    assert.equal(responses.filter((value) => value === "accepted").length, 1);
    assert.equal(responses.filter((value) => value === "duplicate").length, 5);
    const sender = `whatsapp:+1555${String(Date.now()).slice(-7)}`;
    for (let i=0; i<6; i++) {
      const id = sid(); ids.push(id);
      assert.equal(await store.accept(id, {...payload, from:sender}), i < 5 ? "accepted" : "limited");
    }
    // A fresh repository instance also sees existing receipts (not an in-memory cache).
    assert.equal(await createWhatsappStore(() => config.authToken, connect).accept(ids[1], payload), "duplicate");
    const rows = await pool.query(`SELECT state,payload FROM "${schema}".whatsapp_jobs WHERE sid=$1`, [ids[6]]);
    assert.equal(rows.rows[0].state, "sent");
    assert.equal(rows.rows[0].payload, null);
  } finally {
    await pool.query(`DROP SCHEMA "${schema}" CASCADE`);
  }
});

after(async () => { await pool.end(); });
