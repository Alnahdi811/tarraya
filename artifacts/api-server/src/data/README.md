# Organisation directories

Edit `official-domains.json` to maintain the live directory. It is located at
`artifacts/api-server/src/data/official-domains.json`. Each record must include:

- `name` — the organisation's name.
- `category` — a short label such as `bank`, `courier`, or `postal_service`.
- `hostname` — the exact verified hostname, without a scheme or path. Include
  `www` when it is part of the verified hostname. Other hosts or subdomains are
  not accepted unless they are separately verified and added.
- `sourceUrl` — an HTTPS URL to the official source used to confirm ownership.
- `verificationDate` — the date that source and hostname were last checked, as
  `YYYY-MM-DD`.

The checker identifies a listed organisation only when its name (or an
abbreviation in parentheses in that name) appears in the message, then compares
the parsed URL hostname exactly with that organisation's `hostname`. A domain
or subdomain match is not inferred. The source URL is shown in results whenever
the message identifies a listed organisation, including when its hostname does
not match. The server does not fetch submitted URLs or source pages.

Do not put fictional or demonstration entries in the verified list. They belong
in `demo-organisations.ts`, which is kept separate and is not used for live
matches. Do not add a record until its source and ownership have been verified.
