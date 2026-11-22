import type { LinkCheckInput, LinkCheckResult } from "@workspace/api-zod";
import { analyzeDomainLink } from "./link-analysis";
import { analyzeMessageWithAi } from "./message-analysis";

/**
 * Shared end-to-end link and message analysis for the website and future
 * integrations. Domain findings are computed locally before optional AI use.
 */
export async function analyzeLink(
  input: LinkCheckInput,
): Promise<LinkCheckResult> {
  const cleanMessage = input.message?.trim() || undefined;
  const normalizedInput = {
    ...input,
    ...(cleanMessage ? { message: cleanMessage } : { message: undefined }),
  };
  const domainFindings = analyzeDomainLink(normalizedInput);
  const aiAnalysis = await analyzeMessageWithAi(
    cleanMessage,
    input.language,
    domainFindings,
  );

  return {
    ...domainFindings,
    aiAnalysis,
  };
}
