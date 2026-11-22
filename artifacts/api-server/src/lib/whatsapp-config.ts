export interface WhatsappConfig {
  accountSid: string;
  authToken: string;
  from: string;
  webhookUrl: string;
}

export function getWhatsappConfig(): WhatsappConfig | null {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_WHATSAPP_FROM;
  const webhookUrl = process.env.TWILIO_WEBHOOK_URL;
  if (!accountSid || !authToken || !from || !webhookUrl) return null;
  try {
    const url = new URL(webhookUrl);
    if (url.protocol !== "https:" || url.username || url.password || url.hash ||
      url.pathname !== "/api/whatsapp" || url.search ||
      !/^AC[\da-f]{32}$/i.test(accountSid) ||
      !/^whatsapp:\+[1-9]\d{6,14}$/.test(from)) return null;
  } catch {
    return null;
  }
  return { accountSid, authToken, from, webhookUrl };
}
