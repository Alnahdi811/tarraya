import { isIP } from "node:net";
import { Router, type IRouter } from "express";
import {
  AssessLinkBody,
  AssessLinkResponse,
} from "@workspace/api-zod";

const router: IRouter = Router();

const shortenerHosts = new Set([
  "bit.ly",
  "cutt.ly",
  "is.gd",
  "shorturl.at",
  "t.co",
  "tinyurl.com",
]);

const urgencyPattern =
  /\b(urgent|immediately|right now|act now|limited time|suspended|final warning)\b|عاجل(?:اً)?|فوراً|فورًا|حالاً|حالًا|الآن|آخر فرصة|إيقاف حساب/i;
const secretRequestPattern =
  /\b(password|passcode|one[- ]time code|verification code|security code|otp|pin|recovery phrase|private key)\b|كلمة المرور|رمز التحقق|رمز الدخول|الرقم السري|عبارة الاسترداد|المفتاح الخاص/i;

router.post("/link-check", (req, res): void => {
  const input = AssessLinkBody.safeParse(req.body);
  if (!input.success) {
    res.status(400).json({ error: "Please provide a valid URL to review." });
    return;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.data.url.trim());
  } catch {
    res
      .status(400)
      .json({ error: "Enter a complete link, including https:// or http://." });
    return;
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    res.status(400).json({ error: "Only http and https links can be reviewed." });
    return;
  }

  const host = parsedUrl.hostname.toLowerCase();
  const message = input.data.message ?? "";
  const reasonCodes: string[] = [];

  if (parsedUrl.username || parsedUrl.password) {
    reasonCodes.push("embedded_credentials");
  }
  if (host.startsWith("xn--") || host.includes(".xn--")) {
    reasonCodes.push("punycode_host");
  }
  if (isIP(host)) {
    reasonCodes.push("ip_address_host");
  }
  if (shortenerHosts.has(host)) {
    reasonCodes.push("url_shortener");
  }
  if (urgencyPattern.test(message)) {
    reasonCodes.push("pressure_words");
  }
  if (secretRequestPattern.test(message)) {
    reasonCodes.push("password_request");
  }

  const isReservedExample =
    host === "example" || host.endsWith(".example");
  if (isReservedExample) {
    reasonCodes.push("reserved_example_domain");
  }
  if (reasonCodes.length === 0) {
    reasonCodes.push("no_clear_red_flags");
  }

  const hasRiskIndicators = reasonCodes.some((reason) =>
    [
      "embedded_credentials",
      "punycode_host",
      "ip_address_host",
      "url_shortener",
      "pressure_words",
      "password_request",
    ].includes(reason),
  );

  const response = AssessLinkResponse.parse({
    assessment: hasRiskIndicators ? "suspicious" : "insufficient",
    host,
    reasonCodes,
    nextStepCode: hasRiskIndicators
      ? "do_not_open"
      : input.data.message
        ? "ask_sender"
        : "verify_separately",
    disclaimerCode: "text_only",
  });

  res.json(response);
});

export default router;
