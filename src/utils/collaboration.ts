import type { TravelAppData } from "../types";

export const COLLABORATION_ROOM = "deu-10th-fukuoka-trip";

const SECTION_KEYS = [
  "settings",
  "participants",
  "participantMessages",
  "schedules",
  "expenses",
  "preflightChecks",
  "checklists",
  "votes",
  "memories",
  "memberCards",
  "photoLinks",
  "photoLibrary",
  "gameScores",
] as const;

export type TripSectionKey = (typeof SECTION_KEYS)[number];
export type TripSectionSnapshot = Record<TripSectionKey, string>;

const serialize = (value: unknown) => JSON.stringify(value);

const safeParse = <T>(value: string | undefined, fallback: T): T => {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
};

export const buildTripSnapshot = (data: TravelAppData): TripSectionSnapshot =>
  SECTION_KEYS.reduce((snapshot, key) => {
    snapshot[key] = serialize(data[key]);
    return snapshot;
  }, {} as TripSectionSnapshot);

export const readTripDataFromSnapshot = (
  snapshot: Partial<Record<TripSectionKey, string>>,
  fallback: TravelAppData,
): TravelAppData => ({
  settings: safeParse(snapshot.settings, fallback.settings),
  participants: safeParse(snapshot.participants, fallback.participants),
  participantMessages: safeParse(snapshot.participantMessages, fallback.participantMessages),
  schedules: safeParse(snapshot.schedules, fallback.schedules),
  expenses: safeParse(snapshot.expenses, fallback.expenses),
  preflightChecks: safeParse(snapshot.preflightChecks, fallback.preflightChecks),
  checklists: safeParse(snapshot.checklists, fallback.checklists),
  votes: safeParse(snapshot.votes, fallback.votes),
  memories: safeParse(snapshot.memories, fallback.memories),
  memberCards: safeParse(snapshot.memberCards, fallback.memberCards),
  photoLinks: safeParse(snapshot.photoLinks, fallback.photoLinks),
  photoLibrary: safeParse(snapshot.photoLibrary, fallback.photoLibrary),
  gameScores: safeParse(snapshot.gameScores, fallback.gameScores),
});

export const snapshotToKey = (snapshot: Partial<Record<TripSectionKey, string>>) =>
  SECTION_KEYS.map((key) => `${key}:${snapshot[key] ?? ""}`).join("|");

export const snapshotHasData = (snapshot: Partial<Record<TripSectionKey, string>>) =>
  SECTION_KEYS.some((key) => Boolean(snapshot[key]));

export const getShareUrl = () => {
  if (typeof window === "undefined") return "";
  return window.location.href;
};
