import twilio from "twilio";
import type { LinkCheckResult } from "@workspace/api-zod";

export type Language = "ar" | "en";
export function messageLanguage(body: string): Language {
  // URLs and Latin organisation names should not outweigh surrounding Arabic.
  const text = body.replace(/(?:https?:\/\/|www\.)\S+/giu, "");
  return /[\u0600-\u06ff]/u.test(text) || !/[a-z]/iu.test(text) ? "ar" : "en";
}

export function extractUrls(body: string): string[] {
  const matches = body.match(/(?:[a-z][a-z0-9+.-]*:\/\/|www\.)[^\s<>"\u200e\u200f]+/giu) ?? [];
  return [...new Set(matches.map((url) => url.replace(/[.,!?:;،؛؟)\]}>»”’]+$/u, "")))];
}

export function twiml(message?: string): string {
  const response = new twilio.twiml.MessagingResponse();
  if (message) response.message(message);
  return response.toString();
}

export const whatsappCopy = {
  ar: {
    noUrl: "أرسل رابطاً واحداً يبدأ بـ https:// أو http:// لفحصه. لا ترسل كلمات مرور أو بيانات خاصة.",
    multiple: "وصل أكثر من رابط. أرسل رابطاً واحداً فقط في كل رسالة حتى تكون نتيجة الفحص واضحة.",
    invalid: "تعذّر قراءة الرابط. أرسل رابطاً صالحاً يبدأ بـ https:// أو http://.",
    received: "وصل الرابط وسنرسل النتيجة هنا بعد اكتمال الفحص. لن نفتح الموقع. يُحلل نص الرسالة بواسطة OpenAI عبر Replit؛ لا ترسل بيانات حساسة.",
    failed: "تعذّر إكمال الفحص الآن. لا تفتح الرابط ولا ترسل أموالاً أو بيانات حساسة. تحقّق عبر قناة رسمية تعرفها مسبقاً، وحاول لاحقاً.",
    limited: "وصلت إلى حد الفحص. انتظر قليلاً ثم أرسل رابطاً واحداً مجدداً.",
  },
  en: {
    noUrl: "Send one link starting with https:// or http:// to check it. Do not send passwords or private details.",
    multiple: "More than one link was found. Send only one link per message so the result is unambiguous.",
    invalid: "That link could not be parsed. Send a valid link starting with https:// or http://.",
    received: "Link received. We will send the result here when the check finishes. We will not open the site. Message text is analyzed by OpenAI via Replit; do not send sensitive details.",
    failed: "The check could not be completed. Do not open the link or send money or sensitive information. Verify through an official channel you already know, and try later.",
    limited: "The check limit was reached. Wait a while before sending another link.",
  },
} as const;

export function formatWhatsappResult(result: LinkCheckResult): string {
  const ar = result.language === "ar";
  const labels = ar
    ? { suspicious: "مؤشرات تستدعي الحذر", official_domain_match: "اسم المضيف مطابق للدليل، وليس ضماناً للأمان", unverified: "غير موثّق / المعلومات غير كافية" }
    : { suspicious: "Suspicious indicators", official_domain_match: "Hostname matches the directory, not a safety guarantee", unverified: "Unverified / insufficient information" };
  const lines = [
    `Tarraya / تريّا — ${labels[result.assessment]}`,
    result.directoryCheck.message,
    ar ? "الأسباب:" : "Reasons:",
    ...result.evidence.slice(0, 3).map((e) => `• ${e.detail.slice(0, 85)}`),
    ar ? "تحليل الرسالة:" : "Message analysis:",
    result.aiAnalysis.message.slice(0, 140),
    ...result.aiAnalysis.signals.map((signal) => `• ${signal.explanation.slice(0, 75)}`),
    `${ar ? "الخطوة الآمنة التالية" : "Safe next step"}: ${result.nextStep.instruction}`,
    ar ? "لم نفتح الموقع. مطابقة اسم المضيف لا تثبت أن الرسالة آمنة." : "We did not open the site. A hostname match does not prove the message is safe.",
  ];
  if (result.directoryCheck.organisation) {
    lines.push(`${ar ? "مصدر الدليل" : "Directory source"}: ${result.directoryCheck.organisation.sourceUrl}`);
  }
  // Never echo the submitted URL: WhatsApp would turn it into a tappable link.
  return lines.join("\n");
}
