# Organisation directories

Edit `verified-organisations.ts` to maintain the live verified organisation
directory. Each record must include:

- `name` — the organisation's name.
- `officialDomains` — verified organisation-controlled root domains, without a
  scheme or path. Public-suffix-aware matching supports certain explicitly
  delegated namespaces (for example, a verified `service.gov.uk` host); include
  one only when the source confirms that exact domain belongs to the
  organisation.
- `sourceUrl` — an HTTPS URL to the official source used to confirm ownership.
- `dateVerified` — the date that source and domain were last checked, as
  `YYYY-MM-DD`.

The analyzer compares domains with the Public Suffix List, including private
hosting suffixes so separate tenants are not treated as one organisation. Use
an organisation-controlled root domain, never a shared public suffix or a
third-party hosting provider's shared root. Re-check records and update
`dateVerified` whenever the source is reviewed. The server does not fetch the
source or automatically refresh this directory.

Do not put fictional or demonstration entries in the verified list. They belong
in `demo-organisations.ts`, which is kept separate and is not used for live
matches. Do not add a record until its source and ownership have been verified.
