import { isIP } from "node:net";
import { getDomain, parse } from "tldts";
import type {
  LinkCheckEvidence,
  LinkCheckEvidenceCode,
  LinkCheckInput,
  LinkCheckNextStepCode,
  LinkCheckResult,
} from "@workspace/api-zod";
import {
  verifiedOrganisations,
  type VerifiedOrganisation,
} from "../data/verified-organisations";

type Language = LinkCheckInput["language"];
type DomainLinkResult = Omit<LinkCheckResult, "aiAnalysis">;
type DirectoryCheckCode =
  | "exact_match"
  | "hostname_not_listed"
  | "insufficient_information";

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

const evidenceText: Record<
  Language,
  Record<LinkCheckEvidenceCode, string>
> = {
  ar: {
    embedded_credentials: "يحتوي الرابط على بيانات دخول مضمّنة في العنوان.",
    punycode_host: "يستخدم اسم النطاق ترميزاً قد يخفي أحرفاً متشابهة.",
    ip_address_host: "يستخدم الرابط عنوان IP بدلاً من اسم نطاق.",
    url_shortener: "الرابط مختصر، لذلك لا يظهر عنوانه النهائي هنا.",
    insecure_http: "يستخدم الرابط اتصال HTTP غير المشفّر.",
    pressure_words: "تتضمن الرسالة كلمات تضغط لاتخاذ إجراء سريع.",
    password_request: "تطلب الرسالة كلمة مرور أو رمزاً سرياً.",
    official_domain_match:
      "يطابق اسم النطاق المدخل المدرج للجهة {name}، لكن ذلك لا يثبت سلامة الرابط أو الرسالة.",
    organisation_hostname_mismatch:
      "اسم النطاق هذا غير مدرج للجهة المذكورة في الرسالة.",
    organisation_unidentified: "المعلومات غير كافية.",
    reserved_example_domain:
      "هذا نطاق ‎.example محجوز للأمثلة ولا يمثل جهة حقيقية.",
    no_clear_indicators:
      "لم تظهر مؤشرات واضحة في النص المفحوص؛ غيابها لا يثبت أن الرابط آمن.",
  },
  en: {
    embedded_credentials: "The URL contains embedded login details.",
    punycode_host: "The host uses encoding that can disguise similar-looking characters.",
    ip_address_host: "The link uses an IP address instead of a domain name.",
    url_shortener: "This is a shortened link, so its final destination is not visible here.",
    insecure_http: "The link uses an unencrypted HTTP connection.",
    pressure_words: "The message uses language that pressures you to act quickly.",
    password_request: "The message asks for a password or secret sign-in code.",
    official_domain_match:
      "The hostname matches a listed entry for {name}; this does not prove the link or message is safe.",
    organisation_hostname_mismatch:
      "This hostname isn't listed for the organisation named in the message.",
    organisation_unidentified: "Insufficient information.",
    reserved_example_domain:
      "This .example domain is reserved for examples and does not represent a real organisation.",
    no_clear_indicators:
      "No clear warning signs appeared in the text reviewed; that does not prove the link is safe.",
  },
};

const nextStepText: Record<Language, Record<LinkCheckNextStepCode, string>> = {
  ar: {
    do_not_open:
      "لا تفتح الرابط ولا تدخل بياناتك. تواصل مع الجهة عبر موقع أو رقم رسمي تعثر عليه بشكل مستقل.",
    verify_official_channel:
      "تحقّق من الجهة عبر موقعها أو رقمها الرسمي الذي تبحث عنه بنفسك قبل مشاركة أي معلومات.",
    contact_sender:
      "اسأل المرسل عبر وسيلة تواصل تعرفها مسبقاً، ولا تستخدم بيانات الاتصال الموجودة في الرسالة المشكوك فيها.",
  },
  en: {
    do_not_open:
      "Do not open the link or enter details. Contact the organisation through an official website or number you find independently.",
    verify_official_channel:
      "Verify with the organisation through an official website or number you find yourself before sharing information.",
    contact_sender:
      "Ask the sender using a contact method you already know; do not rely on details in a suspicious message.",
  },
};

const directoryCheckText = {
  ar: {
    exact_match: "اسم النطاق يطابق مدخل الدليل.",
    hostname_not_listed: "اسم النطاق هذا غير مدرج للجهة المذكورة في الرسالة.",
    insufficient_information: "المعلومات غير كافية.",
  },
  en: {
    exact_match: "Hostname matches the directory entry.",
    hostname_not_listed:
      "This hostname isn't listed for the organisation named in the message.",
    insufficient_information: "Insufficient information.",
  },
} as const;

const reservedExampleHost = (host: string) =>
  host === "example" || host.endsWith(".example");

export class LinkAnalysisInputError extends Error {
  readonly code: "invalid_url" | "unsupported_protocol" | "invalid_input";

  constructor(
    code: "invalid_url" | "unsupported_protocol" | "invalid_input",
    message: string,
  ) {
    super(message);
    this.code = code;
    this.name = "LinkAnalysisInputError";
  }
}

function getRegistrableDomain(host: string): string | null {
  const plainHost = host.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isIP(plainHost)) return null;
  return getDomain(plainHost, { allowPrivateDomains: true });
}

function validateDirectory(directory: readonly VerifiedOrganisation[]): void {
  for (const record of directory) {
    if (
      !record.name.trim() ||
      !record.category.trim() ||
      !record.hostname ||
      !/^\d{4}-\d{2}-\d{2}$/.test(record.verificationDate) ||
      new Date(`${record.verificationDate}T00:00:00.000Z`)
        .toISOString()
        .slice(0, 10) !== record.verificationDate
    ) {
      throw new Error("Verified organisation directory contains an invalid record.");
    }

    const source = new URL(record.sourceUrl);
    if (
      source.protocol !== "https:" ||
      source.username ||
      source.password
    ) {
      throw new Error("Verified organisation sources must use HTTPS.");
    }

    const hostname = record.hostname.toLowerCase();
    const hostnameUrl = new URL(`https://${record.hostname}`);
    const suffixInfo = parse(hostname, { allowPrivateDomains: true });
    if (
      record.hostname !== hostname ||
      hostname.endsWith(".") ||
      hostnameUrl.hostname !== hostname ||
      hostnameUrl.pathname !== "/" ||
      hostnameUrl.search ||
      hostnameUrl.hash ||
      isIP(hostname) ||
      reservedExampleHost(hostname) ||
      (!getRegistrableDomain(hostname) && !suffixInfo.publicSuffix)
    ) {
      throw new Error(
        `Verified directory hostname is invalid: ${record.hostname}`,
      );
    }
  }
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function messageNamesOrganisation(
  message: string,
  organisation: VerifiedOrganisation,
): boolean {
  const parentheticalNames = Array.from(
    organisation.name.matchAll(/\(([^)]+)\)/g),
    (match) => match[1],
  );
  const names = [
    organisation.name,
    organisation.name.replace(/\s*\([^)]*\)/g, "").trim(),
    ...parentheticalNames,
    ...(organisation.aliases ?? []),
  ].filter(Boolean);
  const normalizedMessage = message.normalize("NFKC");

  return names.some((name) => {
    const phrase = escapeRegExp(name.normalize("NFKC"));
    return new RegExp(
      `(^|[^\\p{L}\\p{N}])${phrase}(?=$|[^\\p{L}\\p{N}])`,
      "iu",
    ).test(normalizedMessage);
  });
}

function findNamedOrganisation(
  message: string | undefined,
  directory: readonly VerifiedOrganisation[],
): VerifiedOrganisation | null {
  if (!message?.trim()) return null;
  const matches = directory.filter((organisation) =>
    messageNamesOrganisation(message, organisation),
  );
  return matches.length === 1 ? matches[0] : null;
}

function localisedEvidence(
  language: Language,
  code: LinkCheckEvidenceCode,
  match?: { name: string },
): LinkCheckEvidence {
  let detail = evidenceText[language][code];
  if (match) {
    detail = detail.replace("{name}", match.name);
  }
  return { code, detail };
}

/**
 * Shared analysis entry point for the website and future integrations.
 * It only parses submitted text and the local verified directory; it never
 * makes a request to the submitted URL or directory source.
 */
export function analyzeDomainLink(
  input: LinkCheckInput,
  directory: readonly VerifiedOrganisation[] = verifiedOrganisations,
): DomainLinkResult {
  validateDirectory(directory);

  if (
    !input ||
    typeof input.url !== "string" ||
    typeof input.language !== "string" ||
    !["ar", "en"].includes(input.language) ||
    (input.message !== undefined && typeof input.message !== "string") ||
    (input.message?.length ?? 0) > 2000
  ) {
    throw new LinkAnalysisInputError(
      "invalid_input",
      "The submitted check details are invalid.",
    );
  }

  const language = input.language;
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(input.url.trim());
  } catch {
    throw new LinkAnalysisInputError(
      "invalid_url",
      language === "ar"
        ? "أدخل رابطاً صالحاً يتضمن https:// أو http://."
        : "Enter a valid link beginning with https:// or http://.",
    );
  }

  if (parsedUrl.protocol !== "https:" && parsedUrl.protocol !== "http:") {
    throw new LinkAnalysisInputError(
      "unsupported_protocol",
      language === "ar"
        ? "يمكن فحص روابط HTTP أو HTTPS فقط."
        : "Only HTTP and HTTPS links can be checked.",
    );
  }

  const host = parsedUrl.hostname.toLowerCase();
  if (!host) {
    throw new LinkAnalysisInputError(
      "invalid_url",
      language === "ar" ? "لم نتمكن من قراءة اسم النطاق." : "The URL has no hostname.",
    );
  }

  const registrableDomain = getRegistrableDomain(host);
  const identifiedOrganisation = findNamedOrganisation(input.message, directory);
  const directoryCheckCode: DirectoryCheckCode = !identifiedOrganisation
    ? "insufficient_information"
    : host === identifiedOrganisation.hostname
      ? "exact_match"
      : "hostname_not_listed";
  const hostnameMatchesOrganisation =
    directoryCheckCode === "exact_match";
  const codes: LinkCheckEvidenceCode[] = [];

  if (parsedUrl.username || parsedUrl.password) {
    codes.push("embedded_credentials");
  }
  if (host.split(".").some((label) => label.startsWith("xn--"))) {
    codes.push("punycode_host");
  }
  if (isIP(host.replace(/^\[|\]$/g, ""))) {
    codes.push("ip_address_host");
  }
  if (shortenerHosts.has(host)) {
    codes.push("url_shortener");
  }
  if (parsedUrl.protocol === "http:") {
    codes.push("insecure_http");
  }
  if (input.message && urgencyPattern.test(input.message)) {
    codes.push("pressure_words");
  }
  if (input.message && secretRequestPattern.test(input.message)) {
    codes.push("password_request");
  }
  if (directoryCheckCode === "exact_match") {
    codes.push("official_domain_match");
  } else if (directoryCheckCode === "hostname_not_listed") {
    codes.push("organisation_hostname_mismatch");
  } else {
    codes.push("organisation_unidentified");
  }
  if (reservedExampleHost(host)) {
    codes.push("reserved_example_domain");
  }

  const riskCodes = new Set<LinkCheckEvidenceCode>([
    "embedded_credentials",
    "punycode_host",
    "ip_address_host",
    "url_shortener",
    "insecure_http",
    "pressure_words",
    "password_request",
  ]);
  const hasRiskIndicators = codes.some((code) => riskCodes.has(code));
  if (!hasRiskIndicators && !hostnameMatchesOrganisation) {
    codes.push("no_clear_indicators");
  }

  const assessment: LinkCheckResult["assessment"] = hasRiskIndicators
    ? "suspicious"
    : hostnameMatchesOrganisation
      ? "official_domain_match"
      : "unverified";
  const nextStepCode: LinkCheckNextStepCode = hasRiskIndicators
    ? "do_not_open"
    : hostnameMatchesOrganisation
      ? "verify_official_channel"
      : input.message
        ? "contact_sender"
        : "verify_official_channel";

  const matchInfo = hostnameMatchesOrganisation && identifiedOrganisation
    ? {
        name: identifiedOrganisation.name,
      }
    : undefined;

  return {
    assessment,
    language,
    host,
    registrableDomain,
    directoryCheck: {
      code: directoryCheckCode,
      message: directoryCheckText[language][directoryCheckCode],
      organisation: identifiedOrganisation
        ? {
            name: identifiedOrganisation.name,
            category: identifiedOrganisation.category,
            hostname: identifiedOrganisation.hostname,
            sourceUrl: identifiedOrganisation.sourceUrl,
            verificationDate: identifiedOrganisation.verificationDate,
          }
        : null,
    },
    evidence: codes.map((code) =>
      localisedEvidence(language, code, matchInfo),
    ),
    nextStep: {
      code: nextStepCode,
      instruction: nextStepText[language][nextStepCode],
    },
    disclaimerCode: hostnameMatchesOrganisation
      ? "domain_match_is_not_safety"
      : "text_only",
  };
}
