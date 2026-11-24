import assert from "node:assert/strict";
import { test } from "node:test";
import { verifiedOrganisations } from "../src/data/verified-organisations";
import { analyzeDomainLink } from "../src/lib/link-analysis";

test("expanded UAE directory has 23 unique, sourced records and no fictional hosts", () => {
  assert.equal(verifiedOrganisations.length, 23);
  assert.equal(new Set(verifiedOrganisations.map((record) => record.hostname)).size, 23);
  for (const record of verifiedOrganisations) {
    assert.equal(new URL(record.sourceUrl).protocol, "https:");
    assert.equal(new URL(record.sourceUrl).hostname, record.hostname);
    assert.match(record.verificationDate, /^2026-11-(23|24)$/);
    assert.doesNotMatch(record.hostname, /(?:^|\.)example$/);
    assert.ok(record.aliases?.length);
    for (const alias of record.aliases) assert.ok(alias.trim());
  }
});

for (const record of verifiedOrganisations) {
  test(`${record.name}: English name and Arabic aliases require its exact hostname`, () => {
    const names = [record.name, ...(record.aliases ?? [])];
    for (const name of names) {
      const language = /[\u0600-\u06ff]/u.test(name) ? "ar" : "en";
      const result = analyzeDomainLink({
        url: `https://${record.hostname}/`, message: `رسالة من ${name}.`, language,
      });
      assert.equal(result.directoryCheck.code, "exact_match", name);
      assert.equal(result.directoryCheck.organisation?.name, record.name, name);
      assert.equal(result.directoryCheck.organisation?.sourceUrl, record.sourceUrl);
      assert.equal(result.disclaimerCode, "domain_match_is_not_safety");
      const wrongHost = analyzeDomainLink({
        url: "https://notice.example/", message: name, language,
      });
      assert.equal(wrongHost.directoryCheck.code, "hostname_not_listed", name);
      assert.equal(wrongHost.directoryCheck.organisation?.sourceUrl, record.sourceUrl);
      const subdomain = analyzeDomainLink({
        url: `https://login.${record.hostname}/`, message: name, language,
      });
      assert.equal(subdomain.directoryCheck.code, "hostname_not_listed", name);
    }
  });
}

test("unknown and ambiguous organisation messages remain inconclusive", () => {
  for (const message of [undefined, "جهة خيالية", "تطبيق تم، شرطة دبي"]) {
    const result = analyzeDomainLink({
      url: "https://www.tamm.abudhabi/", message, language: "ar",
    });
    assert.equal(result.directoryCheck.code, "insufficient_information");
    assert.equal(result.directoryCheck.organisation, null);
  }
});

test("Arabic phrase boundaries and G42 digit variants do not enable partial-name matches", () => {
  assert.equal(analyzeDomainLink({
    url: "https://www.dubaipolice.gov.ae/", message: "كلمةشرطة دبيكلمة", language: "ar",
  }).directoryCheck.code, "insufficient_information");
  for (const message of ["جي 42", "جي ٤٢"]) {
    assert.equal(analyzeDomainLink({
      url: "https://www.g42.ai/", message, language: "ar",
    }).directoryCheck.code, "exact_match");
  }
});

test("separately unlisted www or apex variants never inherit a directory match", () => {
  for (const record of verifiedOrganisations) {
    const alternative = record.hostname.startsWith("www.")
      ? record.hostname.slice(4) : `www.${record.hostname}`;
    assert.equal(analyzeDomainLink({
      url: `https://${alternative}/`, message: record.aliases![0], language: "ar",
    }).directoryCheck.code, "hostname_not_listed", record.name);
  }
});
