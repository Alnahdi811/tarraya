---
name: Public-suffix organisation matching
description: Curating verified organisation domains with public-suffix-aware matching.
---

When adding verified domains, accept registrable roots identified by `tldts` with private suffixes enabled, or a specific multi-label domain that the Public Suffix List treats as a delegated suffix (for example, a verified `service.gov.uk` domain). Reject shared suffix roots such as `github.io`. Match delegated domains only at whole-label boundaries: exact host or a subdomain ending in `.<verified-domain>`. Keep `.example` demonstrations out of the live directory.

**Why:** `tldts` can classify a real delegated government domain as a private suffix and return no registrable domain. Plain suffix matching for every record would instead collapse separate tenants on shared hosting domains.

**How to apply:** When editing the verified organisation directory or changing public-suffix handling, test a delegated domain, a shared-hosting tenant, and a deceptive lookalike suffix.
