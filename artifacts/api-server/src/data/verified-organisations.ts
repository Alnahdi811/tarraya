export interface VerifiedOrganisation {
  name: string;
  officialDomains: string[];
  sourceUrl: string;
  dateVerified: string;
}

/**
 * Curated production directory. Add only organisations whose official domain
 * was checked against the cited source. Fictional examples belong in
 * demo-organisations.ts and must never be copied here.
 */
export const verifiedOrganisations: VerifiedOrganisation[] = [];
