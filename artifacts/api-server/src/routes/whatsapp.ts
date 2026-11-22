import { Router, type IRouter } from "express";
import twilio from "twilio";
import { ReceiveWhatsappBody } from "@workspace/api-zod";
import { getWhatsappConfig, type WhatsappConfig } from "../lib/whatsapp-config";
import { analyzeDomainLink } from "../lib/link-analysis";
import { extractUrls, messageLanguage, twiml, whatsappCopy } from "../lib/whatsapp-message";
import { whatsappStore, type WhatsappStore } from "../lib/whatsapp-store";
import { processWhatsappJobs } from "../lib/whatsapp-worker";

export function createWhatsappRouter(deps: {
  config?: () => WhatsappConfig | null;
  store?: WhatsappStore;
  wake?: () => void;
} = {}): IRouter {
  const router: IRouter = Router();
  router.post("/whatsapp", async (req, res): Promise<void> => {
    const config = (deps.config ?? getWhatsappConfig)();
    if (!config) {
      res.status(503).send("WhatsApp integration is not configured.");
      return;
    }
    if (!req.is("application/x-www-form-urlencoded")) {
      res.status(415).send("Form-encoded webhook required.");
      return;
    }
    const fields = req.body;
    if (!fields || typeof fields !== "object" ||
        Object.values(fields).some((value) => typeof value !== "string")) {
      res.status(400).send("Invalid form fields.");
      return;
    }
    // The external HTTPS URL is configuration, never inferred from untrusted Host
    // or proxy headers. Pass ALL original form fields to the official SDK.
    if (req.originalUrl !== new URL(config.webhookUrl).pathname ||
        !twilio.validateRequest(config.authToken, req.get("X-Twilio-Signature") ?? "", config.webhookUrl, fields)) {
      res.status(403).send("Invalid webhook signature.");
      return;
    }
    const input = ReceiveWhatsappBody.safeParse(fields);
    if (!input.success) {
      res.status(400).send("Invalid WhatsApp fields or message too long.");
      return;
    }
    const { MessageSid, AccountSid, From, To, Body } = input.data;
    if (AccountSid !== config.accountSid || To !== config.from) {
      res.status(403).send("Unexpected WhatsApp account or recipient.");
      return;
    }
    const language = messageLanguage(Body);
    const copy = whatsappCopy[language];
    const urls = extractUrls(Body);
    let reply: string = urls.length === 0 ? copy.noUrl : urls.length > 1 ? copy.multiple : copy.received;
    let url: string | undefined = urls.length === 1 ? urls[0] : undefined;
    if (url) {
      try {
        // Local validation only; never fetch a submitted URL.
        analyzeDomainLink({ url, language });
      } catch {
        url = undefined;
        reply = copy.invalid;
      }
    }
    try {
      const acceptance = (deps.store ?? whatsappStore).accept(MessageSid, url ? {
        url, message: Body, language, from: From, to: To,
      } : null);
      // Do not hold the webhook open for AI or a database outage. If the insert
      // finishes after this timeout, a Twilio retry is safely deduplicated.
      let deadline: ReturnType<typeof setTimeout> | undefined;
      let state: Awaited<typeof acceptance>;
      try {
        state = await Promise.race([acceptance, new Promise<never>((_, reject) => {
          deadline = setTimeout(() => reject(new Error("queue timeout")), 4000);
        })]);
      } finally {
        if (deadline) clearTimeout(deadline);
      }
      if (state === "duplicate") reply = "";
      if (state === "limited") reply = copy.limited;
      res.type("text/xml").send(twiml(reply));
      if (state === "accepted" && url) {
        setImmediate(deps.wake ?? (() => { void processWhatsappJobs(); }));
      }
    } catch {
      req.log?.error("WhatsApp queue acceptance unavailable.");
      res.status(503).send("Check unavailable. Please try again later.");
    }
  });
  return router;
}

export default createWhatsappRouter();
