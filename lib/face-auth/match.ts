import { DEMO_USER_IDS, type DemoUserId } from "../auth-types.ts";

export const FACE_DESCRIPTOR_SIZE = 128;
export const FACE_MATCH_THRESHOLD = 0.48;
export const FACE_MATCH_MARGIN = 0.08;
export const FACE_DUPLICATE_THRESHOLD = 0.34;
export const FACE_ENROLLMENT_SAMPLE_COUNT = 3;

export type FaceDescriptor = number[];

export interface FaceIdentity {
  userId: DemoUserId;
  descriptors: FaceDescriptor[];
}

export function isDemoUserId(value: unknown): value is DemoUserId {
  return typeof value === "string" &&
    Object.values(DEMO_USER_IDS).some((userId) => userId === value);
}

export function isFaceDescriptor(value: unknown): value is FaceDescriptor {
  return Array.isArray(value) &&
    value.length === FACE_DESCRIPTOR_SIZE &&
    value.every((coordinate) =>
      typeof coordinate === "number" &&
      Number.isFinite(coordinate) &&
      coordinate >= -2 &&
      coordinate <= 2,
    );
}

export function isFaceDescriptorSet(value: unknown): value is FaceDescriptor[] {
  return Array.isArray(value) &&
    value.length === FACE_ENROLLMENT_SAMPLE_COUNT &&
    value.every(isFaceDescriptor);
}

export function faceDistance(left: FaceDescriptor, right: FaceDescriptor): number {
  if (!isFaceDescriptor(left) || !isFaceDescriptor(right)) {
    throw new Error("Cannot compare malformed face descriptors.");
  }

  let squaredDistance = 0;
  for (let index = 0; index < FACE_DESCRIPTOR_SIZE; index += 1) {
    const difference = left[index] - right[index];
    squaredDistance += difference * difference;
  }
  return Math.sqrt(squaredDistance);
}

function identityDistance(
  query: readonly FaceDescriptor[],
  registered: readonly FaceDescriptor[],
): number {
  const nearestDistances = query.map((queryDescriptor) =>
    Math.min(...registered.map((registeredDescriptor) =>
      faceDistance(queryDescriptor, registeredDescriptor),
    )),
  );
  return nearestDistances.reduce((sum, distance) => sum + distance, 0) / nearestDistances.length;
}

export function findFaceMatch(
  query: readonly FaceDescriptor[],
  identities: readonly FaceIdentity[],
): DemoUserId | null {
  if (query.length === 0 || !query.every(isFaceDescriptor)) return null;

  const ranked = identities
    .filter((identity) =>
      isDemoUserId(identity.userId) &&
      identity.descriptors.length > 0 &&
      identity.descriptors.every(isFaceDescriptor),
    )
    .map((identity) => ({
      userId: identity.userId,
      distance: identityDistance(query, identity.descriptors),
    }))
    .sort((left, right) => left.distance - right.distance);
  const best = ranked[0];
  if (!best || best.distance > FACE_MATCH_THRESHOLD) return null;

  const runnerUp = ranked[1];
  if (runnerUp && runnerUp.distance - best.distance < FACE_MATCH_MARGIN) return null;
  return best.userId;
}

export function isDuplicateFace(
  descriptors: readonly FaceDescriptor[],
  identities: readonly FaceIdentity[],
  excludedUserId: DemoUserId,
): boolean {
  return identities.some((identity) =>
    identity.userId !== excludedUserId &&
    identity.descriptors.length > 0 &&
    identityDistance(descriptors, identity.descriptors) < FACE_DUPLICATE_THRESHOLD,
  );
}
