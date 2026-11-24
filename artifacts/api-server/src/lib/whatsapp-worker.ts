import twilio from "twilio";
import { CheckLinkResponse } from "@workspace/api-zod";
import { getWhatsappConfig } from "./whatsapp-config";
import { analyzeLink } from "./link-analysis-service";
import { formatWhatsappResult, whatsappCopy } from "./whatsapp-message";
import { claimAnalysis, claimDelivery, finishDelivery, recoverJobs, saveReply } from "./whatsapp-store";
import { logger } from "./logger";
import { safeTwilioErrorDetails } from "./twilio-error";

let timer: ReturnType<typeof setInterval> | undefined;

const workerDependencies = {
  config: getWhatsappConfig, recoverJobs, claimAnalysis, claimDelivery, finishDelivery, saveReply,
  analyze: analyzeLink,
  async send(config: NonNullable<ReturnType<typeof getWhatsappConfig>>, delivery: NonNullable<Awaited<ReturnType<typeof claimDelivery>>>): Promise<void> {
    const client = twilio(config.accountSid, config.authToken, {
      timeout: 8000, autoRetry: false, maxRetries: 0,
    });
    await client.messages.create({
      to: delivery.payload.from, from: delivery.payload.to, body: delivery.reply,
    });
  },
};

export function createWhatsappProcessor(overrides: Partial<typeof workerDependencies> = {}): () => Promise<void> {
  const deps = { ...workerDependencies, ...overrides };
  let busy = false;
  return async (): Promise<void> => {
  const config = deps.config();
  if (busy || !config) return;
  busy = true;
  try {
    await deps.recoverJobs();
    const job = await deps.claimAnalysis();
    if (job?.payload) {
      let reply: string;
      try {
        const result = CheckLinkResponse.parse(await deps.analyze({
          url: job.payload.url,
          message: job.payload.message,
          language: job.payload.language,
        }));
        reply = formatWhatsappResult(result);
      } catch {
        logger.warn("WhatsApp analysis failed; preparing safe failure guidance.");
        reply = whatsappCopy[job.payload.language].failed;
      }
      await deps.saveReply(job.sid, reply);
    }
    const delivery = await deps.claimDelivery();
    if (delivery) {
      try {
        // Retries are disabled: an ambiguous timeout must not send a second message.
        await deps.send(config, delivery);
        await deps.finishDelivery(delivery.sid, "sent");
      } catch (error) {
        logger.error(
          safeTwilioErrorDetails(error),
          "WhatsApp delivery failed or is uncertain; automatic resend suppressed. Check Twilio Messaging logs.",
        );
        await deps.finishDelivery(delivery.sid, "delivery_unknown");
      }
    }
  } catch {
    // Never log SDK/DB error objects: they can contain message bodies or credentials.
    logger.error("WhatsApp queue processing unavailable; pending work remains in the database.");
  } finally {
    busy = false;
  }
  };
}

export const processWhatsappJobs = createWhatsappProcessor();

export function startWhatsappWorker(): void {
  if (timer) return;
  timer = setInterval(() => { void processWhatsappJobs(); }, 1500);
  timer.unref();
  void processWhatsappJobs();
}
