import officialDomains from "./official-domains.json" with { type: "json" };

export interface VerifiedOrganisation {
  name: string;
  aliases?: readonly string[];
  category: string;
  hostname: string;
  sourceUrl: string;
  verificationDate: string;
}

/**
 * Typed view of the curated JSON directory. Fictional examples belong in
 * demo-organisations.ts and must never be copied here.
 */
export const verifiedOrganisations: VerifiedOrganisation[] = officialDomains;
