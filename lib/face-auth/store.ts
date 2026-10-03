import "server-only";

import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { dirname, resolve } from "node:path";
import type { DemoUserId } from "@/lib/auth-types";
import {
  FACE_DUPLICATE_THRESHOLD,
  FACE_ENROLLMENT_SAMPLE_COUNT,
  faceDistance,
  isDemoUserId,
  isFaceDescriptor,
  isFaceDescriptorSet,
  type FaceDescriptor,
  type FaceIdentity,
} from "@/lib/face-auth/match";

interface EncryptedFaceFile {
  version: 1;
  iv: string;
  tag: string;
  ciphertext: string;
}

const storePath = process.env.LUMINA_FACE_STORE_PATH
  ? resolve(process.env.LUMINA_FACE_STORE_PATH)
  : resolve(process.cwd(), ".data", "face-identities.json");
const dataDirectory = dirname(storePath);
const developmentKeyPath = resolve(dataDirectory, "face-encryption.key");

function getEncryptionKey(): Buffer {
  const configuredSecret = process.env.LUMINA_AUTH_SECRET;
  if (configuredSecret) {
    const secret = Buffer.from(configuredSecret, "utf8");
    if (secret.byteLength < 32) {
      throw new Error("LUMINA_AUTH_SECRET must be at least 32 bytes to protect face identity data.");
    }
    return createHash("sha256").update("lumina-face-identities-v1").update(secret).digest();
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("LUMINA_AUTH_SECRET must be configured to protect face identity data.");
  }

  mkdirSync(dirname(developmentKeyPath), { recursive: true, mode: 0o700 });
  try {
    const descriptor = openSync(developmentKeyPath, "wx", 0o600);
    try {
      writeFileSync(descriptor, randomBytes(32).toString("base64url"));
    } finally {
      closeSync(descriptor);
    }
  } catch (cause) {
    if (!(cause instanceof Error) || !("code" in cause) || cause.code !== "EEXIST") throw cause;
  }

  const key = Buffer.from(readFileSync(developmentKeyPath, "utf8"), "base64url");
  if (key.byteLength !== 32) {
    throw new Error("The development face-identity encryption key is invalid.");
  }
  return createHash("sha256").update("lumina-face-identities-v1").update(key).digest();
}

function decryptIdentities(envelope: EncryptedFaceFile): FaceIdentity[] {
  if (envelope.version !== 1) throw new Error("Unsupported face identity data format.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(envelope.iv, "base64url"));
  decipher.setAuthTag(Buffer.from(envelope.tag, "base64url"));
  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(envelope.ciphertext, "base64url")),
    decipher.final(),
  ]).toString("utf8");
  const parsed: unknown = JSON.parse(plaintext);
  if (!Array.isArray(parsed)) throw new Error("Face identity data is malformed.");

  const identities: FaceIdentity[] = [];
  for (const value of parsed) {
    if (
      typeof value !== "object" ||
      value === null ||
      !("userId" in value) ||
      !isDemoUserId(value.userId) ||
      !("descriptors" in value) ||
      !Array.isArray(value.descriptors) ||
      value.descriptors.length < FACE_ENROLLMENT_SAMPLE_COUNT ||
      !value.descriptors.every(isFaceDescriptor)
    ) {
      throw new Error("Face identity data is malformed.");
    }
    identities.push({
      userId: value.userId,
      descriptors: value.descriptors,
    });
  }
  if (new Set(identities.map(({ userId }) => userId)).size !== identities.length) {
    throw new Error("Face identity data contains duplicate user records.");
  }
  return identities;
}

function readIdentities(): FaceIdentity[] {
  if (!existsSync(storePath)) return [];
  const parsed: unknown = JSON.parse(readFileSync(storePath, "utf8"));
  if (
    typeof parsed !== "object" ||
    parsed === null ||
    !("version" in parsed) ||
    parsed.version !== 1 ||
    !("iv" in parsed) ||
    typeof parsed.iv !== "string" ||
    !("tag" in parsed) ||
    typeof parsed.tag !== "string" ||
    !("ciphertext" in parsed) ||
    typeof parsed.ciphertext !== "string"
  ) {
    throw new Error("Encrypted face identity file is malformed.");
  }
  return decryptIdentities(parsed as EncryptedFaceFile);
}

function writeIdentities(identities: readonly FaceIdentity[]): void {
  mkdirSync(dataDirectory, { recursive: true, mode: 0o700 });
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(JSON.stringify(identities), "utf8"),
    cipher.final(),
  ]);
  const envelope: EncryptedFaceFile = {
    version: 1,
    iv: iv.toString("base64url"),
    tag: cipher.getAuthTag().toString("base64url"),
    ciphertext: ciphertext.toString("base64url"),
  };
  const temporaryPath = `${storePath}.${randomBytes(8).toString("hex")}.tmp`;
  try {
    writeFileSync(temporaryPath, JSON.stringify(envelope), { flag: "wx", mode: 0o600 });
    renameSync(temporaryPath, storePath);
  } finally {
    if (existsSync(temporaryPath)) unlinkSync(temporaryPath);
  }
}

export function getFaceIdentity(userId: DemoUserId): FaceIdentity | null {
  return readIdentities().find((identity) => identity.userId === userId) ?? null;
}

export function hasFaceIdentity(userId: DemoUserId): boolean {
  return getFaceIdentity(userId) !== null;
}

export function listFaceIdentities(): readonly FaceIdentity[] {
  return readIdentities();
}

export function registerFaceIdentity(userId: DemoUserId, descriptors: FaceDescriptor[]): void {
  if (!isFaceDescriptorSet(descriptors)) {
    throw new Error(`Face registration requires exactly ${FACE_ENROLLMENT_SAMPLE_COUNT} valid face samples.`);
  }
  const identities = readIdentities();
  if (identities.some((identity) => identity.userId === userId)) {
    throw new Error("FACE_ALREADY_REGISTERED");
  }
  const alreadyRegistered = identities.some((identity) =>
    identity.descriptors.some((stored) =>
      descriptors.some((candidate) => faceDistance(stored, candidate) < FACE_DUPLICATE_THRESHOLD),
    ),
  );
  if (alreadyRegistered) throw new Error("FACE_ALREADY_ASSIGNED");

  writeIdentities([...identities, { userId, descriptors }]);
}
