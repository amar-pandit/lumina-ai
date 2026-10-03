import assert from "node:assert/strict";
import test from "node:test";
import { matchPasswordCredential } from "../lib/auth/credential-match.ts";
import { DEMO_USER_IDS } from "../lib/auth-types.ts";
import { DEMO_ACCOUNT_CREDENTIALS } from "../lib/auth/demo-account-credentials.ts";

test("each demo password resolves only to its own immutable user identity and role", () => {
  for (const account of DEMO_ACCOUNT_CREDENTIALS) {
    assert.equal(account.id, DEMO_USER_IDS[account.role]);
    assert.deepEqual(
      matchPasswordCredential(DEMO_ACCOUNT_CREDENTIALS, account.email, account.password),
      account,
    );
  }
  assert.equal(new Set(DEMO_ACCOUNT_CREDENTIALS.map(({ id }) => id)).size, DEMO_ACCOUNT_CREDENTIALS.length);
  assert.notEqual(DEMO_USER_IDS.HOD, DEMO_USER_IDS.ADMIN);
  assert.notEqual(DEMO_USER_IDS.FACULTY, DEMO_USER_IDS.HOD);
  assert.notEqual(DEMO_USER_IDS.STUDENT, DEMO_USER_IDS.FACULTY);
});

test("credentials cannot authenticate a different account or a wrong password", () => {
  assert.equal(matchPasswordCredential(DEMO_ACCOUNT_CREDENTIALS, "student@lumina.demo", "admin123"), null);
  assert.equal(matchPasswordCredential(DEMO_ACCOUNT_CREDENTIALS, "admin@lumina.demo", "student123"), null);
  assert.equal(matchPasswordCredential(DEMO_ACCOUNT_CREDENTIALS, "student@lumina.demo", "wrongpassword"), null);
  assert.equal(matchPasswordCredential(DEMO_ACCOUNT_CREDENTIALS, "hod@lumina.demo", "admin123"), null);
});
