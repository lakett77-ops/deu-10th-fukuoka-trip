export type AttendanceStatus = "확정" | "미정" | "불참" | "중간 합류" | "중간 이탈";

export type ScheduleCategory =
  | "이동"
  | "식사"
  | "관광"
  | "자유시간"
  | "숙소"
  | "술자리"
  | "기타";

export type ExpenseCategory =
  | "항공"
  | "숙소"
  | "식사"
  | "술"
  | "교통"
  | "쇼핑공용"
  | "액티비티"
  | "기타";

export type ChecklistKind = "개인" | "공용";

export type VoteCategory =
  | "숙소 후보"
  | "라멘/식당 후보"
  | "이자카야/술집 후보"
  | "카페 후보"
  | "관광지/액티비티 후보"
  | "쇼핑 장소 후보";

export interface TripSettings {
  appName: string;
  title: string;
  destination: string;
  startDate: string;
  endDate: string;
  announcement: string;
  exchangeRate: number;
  homeEmojis: string[];
}

export interface Participant {
  id: string;
  name: string;
  nickname: string;
  status: AttendanceStatus;
  flightBooked: boolean;
  accommodationPaid: boolean;
  transport: string;
  passportChecked: boolean;
  memo: string;
  bankName: string;
  accountNumber: string;
}

export interface ParticipantMessage {
  id: string;
  targetParticipantId: string;
  authorParticipantId: string;
  createdAt: string;
  content: string;
}

export interface ScheduleItem {
  id: string;
  date: string;
  time: string;
  title: string;
  place: string;
  travelTime: string;
  memo: string;
  category: ScheduleCategory;
}

export interface Expense {
  id: string;
  title: string;
  amountKRW: number;
  amountJPY?: number;
  exchangeRate?: number;
  payerId: string;
  participantIds: string[];
  splitMode?: "균등 분할" | "개인별 금액";
  customShares?: ExpenseShare[];
  category: ExpenseCategory;
  memo: string;
}

export interface ExpenseShare {
  participantId: string;
  amountKRW: number;
  amountJPY?: number;
}

export interface ChecklistItem {
  id: string;
  name: string;
  kind: ChecklistKind;
  ownerId: string;
  done: boolean;
  memo: string;
}

export interface PreflightCheckItem {
  id: string;
  name: string;
  done: boolean;
  memo: string;
}

export interface VoteCandidate {
  id: string;
  title: string;
  voterIds: string[];
}

export interface VoteTopic {
  id: string;
  title: string;
  description: string;
  category: VoteCategory;
  candidates: VoteCandidate[];
  linkMemo: string;
}

export interface MemoryItem {
  id: string;
  year: number;
  title: string;
  description: string;
  photoUrl: string;
  memo: string;
}

export interface MemberCard {
  id: string;
  name: string;
  collegeNickname: string;
  legendaryMoment: string;
  currentStatus: string;
  anniversaryMessage: string;
}

export interface PhotoLink {
  id: string;
  label: string;
  url: string;
  memo: string;
}

export interface PhotoLibraryItem {
  id: string;
  year: number;
  imageDataUrl: string;
  fileName: string;
  uploadedById: string;
  createdAt: string;
}

export interface TravelAppData {
  settings: TripSettings;
  participants: Participant[];
  participantMessages: ParticipantMessage[];
  schedules: ScheduleItem[];
  expenses: Expense[];
  preflightChecks: PreflightCheckItem[];
  checklists: ChecklistItem[];
  votes: VoteTopic[];
  memories: MemoryItem[];
  memberCards: MemberCard[];
  photoLinks: PhotoLink[];
  photoLibrary: PhotoLibraryItem[];
}

export type MainTab = "home" | "schedule" | "settlement" | "checklist" | "more";
export type MoreView = "menu" | "participants" | "vote" | "memories" | "settings";
