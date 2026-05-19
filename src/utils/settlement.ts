import type { Expense, Participant } from "../types";

export interface PersonSettlement {
  participantId: string;
  paid: number;
  share: number;
  balance: number;
}

export interface Transfer {
  fromId: string;
  toId: string;
  amount: number;
}

export interface SettlementResult {
  total: number;
  averagePerParticipant: number;
  people: PersonSettlement[];
  transfers: Transfer[];
}

export interface ExpenseShareBreakdown {
  participantId: string;
  amountKRW: number;
  amountJPY?: number;
}

export const convertJPYToKRW = (amountJPY: number, exchangeRate: number) =>
  Math.round(amountJPY * exchangeRate);

export const formatKRW = (amount: number) =>
  new Intl.NumberFormat("ko-KR", {
    style: "currency",
    currency: "KRW",
    maximumFractionDigits: 0,
  }).format(Math.round(amount));

const normalizeAmount = (value: number | undefined | null) => Math.max(0, Math.round(Number(value) || 0));

const splitEvenly = (amount: number, count: number) => {
  if (count <= 0) return [] as number[];

  const baseShare = Math.floor(amount / count);
  let remainder = amount - baseShare * count;

  return Array.from({ length: count }, (_, index) => {
    if (remainder <= 0) return baseShare;
    remainder -= 1;
    return baseShare + 1;
  });
};

const debtKey = (fromId: string, toId: string) => `${fromId}::${toId}`;

const addDebt = (debtMap: Map<string, number>, fromId: string, toId: string, amount: number) => {
  if (!fromId || !toId || fromId === toId || amount <= 0) return;
  const key = debtKey(fromId, toId);
  debtMap.set(key, (debtMap.get(key) ?? 0) + amount);
};

const resolveExpenseAmount = (expense: Expense) => {
  const exchangeRate = expense.exchangeRate ?? 0;
  const krwAmount = normalizeAmount(expense.amountKRW);
  if (krwAmount > 0) return krwAmount;

  if (expense.amountJPY && exchangeRate > 0) {
    return convertJPYToKRW(expense.amountJPY, exchangeRate);
  }

  return 0;
};

const resolveShareAmount = (share: { amountKRW: number; amountJPY?: number }, exchangeRate: number) => {
  const krwAmount = normalizeAmount(share.amountKRW);
  if (krwAmount > 0) return krwAmount;

  if (share.amountJPY && exchangeRate > 0) {
    return convertJPYToKRW(share.amountJPY, exchangeRate);
  }

  return 0;
};

export const getExpenseShareBreakdown = (
  expense: Expense,
  fallbackExchangeRate = 0,
): ExpenseShareBreakdown[] => {
  const participantIds = expense.participantIds.filter(Boolean);
  if (!participantIds.length) return [];

  const exchangeRate = expense.exchangeRate ?? fallbackExchangeRate;
  const customShares = (expense.customShares ?? []).filter((share) => participantIds.includes(share.participantId));
  const customTotal = customShares.reduce((sum, share) => sum + resolveShareAmount(share, exchangeRate), 0);
  const hasCustomSplit = expense.splitMode === "개인별 금액" && customTotal > 0;

  if (hasCustomSplit) {
    const breakdown: ExpenseShareBreakdown[] = [];
    participantIds.forEach((participantId) => {
      const share = customShares.find((item) => item.participantId === participantId);
      const amountKRW = share ? resolveShareAmount(share, exchangeRate) : 0;
      if (amountKRW <= 0) return;

      const amountJPY =
        share?.amountJPY && share.amountJPY > 0
          ? share.amountJPY
          : exchangeRate > 0
            ? Math.round(amountKRW / exchangeRate)
            : undefined;

      breakdown.push({
        participantId,
        amountKRW,
        amountJPY,
      });
    });

    return breakdown;
  }

  const totalKRW = resolveExpenseAmount(expense);
  if (totalKRW <= 0) return [];

  const splitKRW = splitEvenly(totalKRW, participantIds.length);
  const splitJPY =
    expense.amountJPY && expense.amountJPY > 0
      ? splitEvenly(expense.amountJPY, participantIds.length)
      : undefined;

  return participantIds.map((participantId, index) => {
    const amountKRW = splitKRW[index] ?? 0;
    const amountJPY =
      splitJPY?.[index] ??
      (exchangeRate > 0 && amountKRW > 0 ? Math.round(amountKRW / exchangeRate) : undefined);

    return {
      participantId,
      amountKRW,
      amountJPY,
    };
  });
};

const buildNetTransfers = (debtMap: Map<string, number>): Transfer[] => {
  const transfers: Transfer[] = [];
  const processed = new Set<string>();

  for (const [key, amount] of debtMap.entries()) {
    if (processed.has(key)) continue;

    const [fromId, toId] = key.split("::");
    const reverseKey = debtKey(toId, fromId);
    const reverseAmount = debtMap.get(reverseKey) ?? 0;

    processed.add(key);
    processed.add(reverseKey);

    const netAmount = amount - reverseAmount;
    if (netAmount > 0) {
      transfers.push({ fromId, toId, amount: netAmount });
    } else if (netAmount < 0) {
      transfers.push({ fromId: toId, toId: fromId, amount: -netAmount });
    }
  }

  return transfers.sort((a, b) => b.amount - a.amount || a.fromId.localeCompare(b.fromId) || a.toId.localeCompare(b.toId));
};

export const calculateSettlement = (
  expenses: Expense[],
  participants: Participant[],
): SettlementResult => {
  const people = participants.map<PersonSettlement>((participant) => ({
    participantId: participant.id,
    paid: 0,
    share: 0,
    balance: 0,
  }));
  const byId = new Map(people.map((person) => [person.participantId, person]));
  const pairwiseDebts = new Map<string, number>();
  const participantIdsWithShare = new Set<string>();
  let total = 0;

  expenses.forEach((expense) => {
    const payer = byId.get(expense.payerId);
    if (!payer) return;

    const memberIds = expense.participantIds.filter((id) => byId.has(id));
    if (!memberIds.length) return;

    const exchangeRate = expense.exchangeRate ?? 0;
    const customShares = (expense.customShares ?? [])
      .filter((share) => memberIds.includes(share.participantId))
      .map((share) => ({
        participantId: share.participantId,
        amountKRW: resolveShareAmount(share, exchangeRate),
      }))
      .filter((share) => share.amountKRW > 0);

    const customTotal = customShares.reduce((sum, share) => sum + share.amountKRW, 0);
    const hasCustomSplit = customShares.length > 0 && customTotal > 0;
    const amount = hasCustomSplit ? customTotal : resolveExpenseAmount(expense);

    if (amount <= 0) return;

    total += amount;
    payer.paid += amount;

    if (hasCustomSplit) {
      customShares.forEach((share) => {
        const person = byId.get(share.participantId);
        if (!person) return;

        participantIdsWithShare.add(share.participantId);
        person.share += share.amountKRW;

        if (share.participantId !== expense.payerId) {
          addDebt(pairwiseDebts, share.participantId, expense.payerId, share.amountKRW);
        }
      });
      return;
    }

    const splitShares = splitEvenly(amount, memberIds.length);
    memberIds.forEach((participantId, index) => {
      const shareAmount = splitShares[index] ?? 0;
      const person = byId.get(participantId);
      if (!person) return;

      participantIdsWithShare.add(participantId);
      person.share += shareAmount;

      if (participantId !== expense.payerId && shareAmount > 0) {
        addDebt(pairwiseDebts, participantId, expense.payerId, shareAmount);
      }
    });
  });

  people.forEach((person) => {
    person.balance = Math.round(person.paid - person.share);
  });

  return {
    total: Math.round(total),
    averagePerParticipant: participantIdsWithShare.size
      ? Math.round(total / participantIdsWithShare.size)
      : 0,
    people,
    transfers: buildNetTransfers(pairwiseDebts),
  };
};
