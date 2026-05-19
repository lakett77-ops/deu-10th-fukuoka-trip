const toLocalDate = (dateString: string) => {
  const [year, month, day] = dateString.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export const calculateDday = (startDate: string, endDate?: string) => {
  const today = new Date();
  const start = toLocalDate(startDate);
  const end = endDate ? toLocalDate(endDate) : start;
  const todayOnly = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const day = 1000 * 60 * 60 * 24;
  const diffToStart = Math.ceil((start.getTime() - todayOnly.getTime()) / day);

  if (diffToStart > 0) {
    return `D-${diffToStart}`;
  }

  const diffFromEnd = Math.floor((todayOnly.getTime() - end.getTime()) / day);
  if (diffFromEnd > 0) {
    return `D+${diffFromEnd}`;
  }

  return "D-Day";
};

export const formatKoreanDate = (dateString: string) => {
  const date = toLocalDate(dateString);
  return new Intl.DateTimeFormat("ko-KR", {
    month: "long",
    day: "numeric",
    weekday: "short",
  }).format(date);
};

export const formatDateRange = (startDate: string, endDate: string) => {
  const start = toLocalDate(startDate);
  const end = toLocalDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startText = new Intl.DateTimeFormat("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }).format(start);
  const endText = new Intl.DateTimeFormat("ko-KR", {
    year: sameYear ? undefined : "numeric",
    month: "long",
    day: "numeric",
  }).format(end);

  return `${startText} - ${endText}`;
};

export const formatDateTime = (isoString: string) =>
  new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(isoString));
