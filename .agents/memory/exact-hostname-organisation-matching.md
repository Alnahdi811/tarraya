---
name: Exact hostname organisation matching
description: Tarraya's verified host checks require a named organisation and exact host equality.
---

For Tarraya live checks, first identify exactly one listed organisation from the user's message, then compare the parsed URL hostname to that record's verified hostname using exact equality. Do not infer a match from a registrable domain, parent domain, or subdomain. Keep `.example` demonstrations out of the live directory.

**Why:** The user requires each hostname to be separately verified and only considered in the context of the organisation named in the message. Treating sibling hosts or subdomains as matches would imply a verification that was never recorded.

**How to apply:** When editing Tarraya's official hostname directory or changing its checker, test an exact host, a sibling/subdomain mismatch, an unidentified organisation, and fictional `.example` links.
