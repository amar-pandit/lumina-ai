export interface PasswordCredentialRecord {
  email: string;
  password: string;
}

export function matchPasswordCredential<T extends PasswordCredentialRecord>(
  accounts: readonly T[],
  identifier: string,
  password: string,
): T | null {
  const normalizedIdentifier = identifier.trim().toLowerCase();
  return accounts.find(
    (account) => account.email.toLowerCase() === normalizedIdentifier && account.password === password,
  ) ?? null;
}
