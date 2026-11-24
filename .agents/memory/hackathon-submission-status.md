---
name: Hackathon submission scope
description: User-specified demo boundary and WhatsApp verification status for submission claims.
---

The web checker is the hackathon demo. Twilio inbound webhook requests reached
the app, but live WhatsApp replies were not confirmed, and the production sender
is pending Meta business verification.

**Why:** The user explicitly supplied this status for the submission. Do not
equate HTTP 200, synthetic tests or unrelated outbound records with a confirmed
end-to-end WhatsApp demonstration.

**How to apply:** Keep README, demo scripts and submission claims within this
scope until the user supplies a newer confirmed status. Do not publish or
change repository visibility on the user's behalf.
