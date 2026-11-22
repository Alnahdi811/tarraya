export interface WhatsappConfig {
  accountSid: string;
  authToken: string;
  from: string;
  webhookUrl: string;
}

export function normalizeWhatsappSender(value: string): string {
  const number = value.trim().replace(/^whatsapp:\s*/i, "").replace(/[\s()-]/g, "");
  if (/^\+?[1-9]\d{6,14}$/.test(number)) {
    return `whatsapp:${number.startsWith("+") ? number : `+${number}`}`;
  }
  return value.trim();
}

function readWhatsappConfig(): { config: WhatsappConfig | null; invalidFields: string[] } {
  const accountSid = process.env.TWILIO_ACCOUNT_SID?.trim() ?? "";
  const authToken = process.env.TWILIO_AUTH_TOKEN?.trim() ?? "";
  const from = normalizeWhatsappSender(process.env.TWILIO_WHATSAPP_FROM ?? "");
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL?.trim() ?? "";
  const invalidFields: string[] = [];
  if (!/^AC[\da-f]{32}$/i.test(accountSid)) invalidFields.push("TWILIO_ACCOUNT_SID");
  if (!authToken) invalidFields.push("TWILIO_AUTH_TOKEN");
  if (!/^whatsapp:\+[1-9]\d{6,14}$/.test(from)) invalidFields.push("TWILIO_WHATSAPP_FROM");
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      url.pathname !== "/api/whatsapp" || url.search) invalidFields.push("TWILIO_WEBHOOK_URL");
  } catch {
    invalidFields.push("TWILIO_WEBHOOK_URL");
  }
  return { config: invalidFields.length ? null : { accountSid, authToken, from, webhookUrl }, invalidFields };
}

export function getWhatsappConfig(): WhatsappConfig | null {
  return readWhatsappConfig().config;
}

/** Safe operator diagnostics: reports key names only, never secret values. */
export function getWhatsappConfigurationStatus(): { configured: boolean; invalidFields: string[] } {
  const { config, invalidFields } = readWhatsappConfig();
  return { configured: config !== null, invalidFields };
}
