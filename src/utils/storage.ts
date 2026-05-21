import { defaultData } from "../data/defaultData";
import type { Participant, TravelAppData } from "../types";

const STORAGE_KEY = "deu-10th-fukuoka-trip-data";

export const stripPhotoLibraryFromData = (data: TravelAppData): TravelAppData => ({
  ...data,
  photoLibrary: [],
});

const cloneDefaultData = (): TravelAppData => {
  if (typeof structuredClone === "function") {
    return structuredClone(defaultData);
  }

  return JSON.parse(JSON.stringify(defaultData)) as TravelAppData;
};

const guessBankName = (accountNumber: string) => {
  const firstChunk = accountNumber.trim().split(/\s+/)[0] ?? "";
  return firstChunk && !/^\d/.test(firstChunk) ? firstChunk : "";
};

const stripBankName = (accountNumber: string, bankName: string) => {
  const trimmed = accountNumber.trim();
  return bankName && trimmed.startsWith(bankName) ? trimmed.slice(bankName.length).trim() : trimmed;
};

const hydrateParticipant = (participant: Partial<Participant>, fallback: Participant): Participant => {
  const rawAccountNumber = participant.accountNumber ?? fallback.accountNumber;
  const bankName = participant.bankName || fallback.bankName || guessBankName(rawAccountNumber);

  return {
    ...fallback,
    ...participant,
    bankName,
    accountNumber: stripBankName(rawAccountNumber, bankName),
  };
};

const mergeWithDefaults = (stored: Partial<TravelAppData>): TravelAppData => {
  const defaults = cloneDefaultData();

  return {
    settings: { ...defaultData.settings, ...stored.settings },
    participants: stored.participants?.length
      ? stored.participants.map((participant, index) =>
          hydrateParticipant(participant, defaults.participants[index] ?? defaults.participants[0]),
        )
      : defaults.participants,
    participantMessages: stored.participantMessages ?? defaults.participantMessages,
    schedules: stored.schedules ?? defaults.schedules,
    expenses: stored.expenses ?? defaults.expenses,
    preflightChecks: stored.preflightChecks ?? defaults.preflightChecks,
    checklists: stored.checklists ?? defaults.checklists,
    votes: stored.votes ?? defaults.votes,
    memories: stored.memories ?? defaults.memories,
    memberCards: stored.memberCards ?? defaults.memberCards,
    photoLinks: stored.photoLinks ?? defaults.photoLinks,
    photoLibrary: stored.photoLibrary ?? defaults.photoLibrary,
    gameScores: stored.gameScores ?? defaults.gameScores,
  };
};

export const loadTripData = (): TravelAppData => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return cloneDefaultData();
    }

    return mergeWithDefaults(JSON.parse(raw) as Partial<TravelAppData>);
  } catch {
    return cloneDefaultData();
  }
};

export const saveTripData = (data: TravelAppData) => {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(stripPhotoLibraryFromData(data)));
};

export const clearTripData = () => {
  localStorage.removeItem(STORAGE_KEY);
};

export const restoreDefaultTripData = (): TravelAppData => cloneDefaultData();
