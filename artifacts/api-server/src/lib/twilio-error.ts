/** Allowlist numeric diagnostics only; never log an SDK error object or message. */
export function safeTwilioErrorDetails(error: unknown): {
  twilioErrorCode?: number;
  httpStatus?: number;
} {
  if (!error || typeof error !== "object") return {};
  const value = error as { code?: unknown; status?: unknown };
  const details: { twilioErrorCode?: number; httpStatus?: number } = {};
  if (typeof value.code === "number" && Number.isInteger(value.code) && value.code > 0) {
    details.twilioErrorCode = value.code;
  }
  if (typeof value.status === "number" && Number.isInteger(value.status) &&
      value.status >= 100 && value.status <= 599) {
    details.httpStatus = value.status;
  }
  return details;
}
