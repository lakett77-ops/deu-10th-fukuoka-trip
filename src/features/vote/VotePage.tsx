import { Dispatch, FormEvent, SetStateAction, useMemo, useRef, useState } from "react";
import { ArrowLeft, Check, ExternalLink, Globe, Loader2, MapPin, Plus, RotateCcw, Search, Trash2 } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { PlaceDetail, TravelAppData, VoteCandidate, VoteCategory, VoteTopic } from "../../types";
import { createId } from "../../utils/id";
import { searchPlaceDetails } from "../../utils/placeDetails";

interface VotePageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

const categories: VoteCategory[] = [
  "숙소 후보",
  "라멘/식당 후보",
  "이자카야/술집 후보",
  "카페 후보",
  "관광지/액티비티 후보",
  "쇼핑 장소 후보",
];

const emptyTopic: Omit<VoteTopic, "id"> = {
  title: "",
  description: "",
  category: "라멘/식당 후보",
  linkMemo: "",
  candidates: [],
};

const formatPlaceType = (detail: PlaceDetail) =>
  [detail.category, detail.type].filter(Boolean).join(" / ") || "정보 없음";

const formatCoord = (value: number) => value.toFixed(5);

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[72px,1fr] gap-2 rounded-lg bg-white/80 px-3 py-2 text-sm">
      <span className="font-bold text-slate-500">{label}</span>
      <span className="break-words text-slate-900">{value || "정보 없음"}</span>
    </div>
  );
}

function PlaceDetailPanel({
  detail,
  onEdit,
  onClear,
}: {
  detail: PlaceDetail;
  onEdit: () => void;
  onClear: () => void;
}) {
  const extraTags = Object.entries(detail.tags).sort(([left], [right]) => left.localeCompare(right));

  return (
    <div className="mt-3 rounded-lg bg-teal-50/70 p-3 ring-1 ring-teal-100">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-black uppercase tracking-wide text-teal-600">가게 상세</p>
          <h3 className="mt-1 break-words text-base font-black text-slate-900">{detail.name}</h3>
          <p className="mt-1 text-xs text-slate-500">OpenStreetMap / Nominatim</p>
        </div>
        <div className="flex shrink-0 gap-2">
          <a
            href={detail.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-slate-700 shadow-sm"
          >
            <MapPin size={14} />
            지도
          </a>
          {detail.website && (
            <a
              href={detail.website}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-9 items-center gap-1 rounded-lg bg-white px-3 text-xs font-bold text-slate-700 shadow-sm"
            >
              <Globe size={14} />
              홈페이지
            </a>
          )}
        </div>
      </div>

      <div className="mt-3 space-y-2">
        <MetaRow label="주소" value={detail.address} />
        <MetaRow label="종류" value={formatPlaceType(detail)} />
        <MetaRow label="전화" value={detail.phone} />
        <MetaRow label="영업" value={detail.openingHours} />
        <MetaRow label="좌표" value={`${formatCoord(detail.latitude)}, ${formatCoord(detail.longitude)}`} />
        <MetaRow label="국가" value={detail.countryCode.toUpperCase()} />
      </div>

      <div className="mt-3 overflow-hidden rounded-lg border border-white bg-white shadow-sm">
        <iframe
          title={`${detail.name} 지도 미리보기`}
          src={detail.embedMapUrl}
          className="h-44 w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>

      {extraTags.length > 0 && (
        <details className="mt-3 rounded-lg border border-teal-100 bg-white/90 p-3">
          <summary className="cursor-pointer text-sm font-bold text-slate-700">추가 태그 보기</summary>
          <div className="mt-3 flex flex-wrap gap-2">
            {extraTags.map(([key, value]) => (
              <span key={key} className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                {key}: {value}
              </span>
            ))}
          </div>
        </details>
      )}

      <div className="mt-3 flex gap-2">
        <button
          type="button"
          onClick={onEdit}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-slate-900 px-3 font-bold text-white"
        >
          <Search size={16} />
          다시 검색
        </button>
        <button
          type="button"
          onClick={onClear}
          className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-lg bg-white px-3 font-bold text-rose-600 shadow-sm"
        >
          <Trash2 size={16} />
          연결 해제
        </button>
      </div>
    </div>
  );
}

export default function VotePage({ data, setData, onBack }: VotePageProps) {
  const [selectedVoterId, setSelectedVoterId] = useState(data.participants[0]?.id ?? "");
  const [topicModalOpen, setTopicModalOpen] = useState(false);
  const [candidateTopicId, setCandidateTopicId] = useState<string | null>(null);
  const [topicForm, setTopicForm] = useState<Omit<VoteTopic, "id">>(emptyTopic);
  const [candidateTitle, setCandidateTitle] = useState("");
  const [placeModalTarget, setPlaceModalTarget] = useState<{ topicId: string; candidateId: string } | null>(null);
  const [placeQuery, setPlaceQuery] = useState("");
  const [placeResults, setPlaceResults] = useState<PlaceDetail[]>([]);
  const [placeLoading, setPlaceLoading] = useState(false);
  const [placeError, setPlaceError] = useState("");
  const placeSearchRequestId = useRef(0);

  const participantById = useMemo(
    () => new Map(data.participants.map((participant) => [participant.id, participant])),
    [data.participants],
  );

  const placeTargetCandidate = useMemo(() => {
    if (!placeModalTarget) return null;

    const topic = data.votes.find((item) => item.id === placeModalTarget.topicId) ?? null;
    const candidate = topic?.candidates.find((item) => item.id === placeModalTarget.candidateId) ?? null;

    return { topic, candidate };
  }, [data.votes, placeModalTarget]);

  const updateCandidate = (
    topicId: string,
    candidateId: string,
    updater: (candidate: VoteCandidate) => VoteCandidate,
  ) => {
    setData((current) => ({
      ...current,
      votes: current.votes.map((topic) =>
        topic.id !== topicId
          ? topic
          : {
              ...topic,
              candidates: topic.candidates.map((candidate) =>
                candidate.id !== candidateId ? candidate : updater(candidate),
              ),
            },
      ),
    }));
  };

  const updateTopicCandidates = (topicId: string, updater: (candidates: VoteCandidate[]) => VoteCandidate[]) => {
    setData((current) => ({
      ...current,
      votes: current.votes.map((topic) => (topic.id === topicId ? { ...topic, candidates: updater(topic.candidates) } : topic)),
    }));
  };

  const saveTopic = (event: FormEvent) => {
    event.preventDefault();
    if (!topicForm.title.trim()) return;

    setData((current) => ({
      ...current,
      votes: [...current.votes, { ...topicForm, id: createId("vote") }],
    }));
    setTopicForm(emptyTopic);
    setTopicModalOpen(false);
  };

  const deleteTopic = (topicId: string) => {
    if (!confirm("이 투표 항목을 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      votes: current.votes.filter((topic) => topic.id !== topicId),
    }));
  };

  const deleteAllVotes = () => {
    if (!confirm("후보 투표 항목을 전체 삭제할까요?")) return;
    setData((current) => ({
      ...current,
      votes: [],
    }));
  };

  const saveCandidate = (event: FormEvent) => {
    event.preventDefault();
    if (!candidateTopicId || !candidateTitle.trim()) return;

    updateTopicCandidates(candidateTopicId, (candidates) => [
      ...candidates,
      { id: createId("candidate"), title: candidateTitle.trim(), voterIds: [] },
    ]);
    setCandidateTitle("");
    setCandidateTopicId(null);
  };

  const deleteCandidate = (topicId: string, candidateId: string) => {
    if (!confirm("이 후보를 삭제할까요?")) return;
    updateTopicCandidates(topicId, (candidates) => candidates.filter((candidate) => candidate.id !== candidateId));
  };

  const toggleVote = (topicId: string, candidateId: string) => {
    if (!selectedVoterId) return;
    updateCandidate(topicId, candidateId, (candidate) => {
      const voted = candidate.voterIds.includes(selectedVoterId);
      return {
        ...candidate,
        voterIds: voted ? candidate.voterIds.filter((id) => id !== selectedVoterId) : [...candidate.voterIds, selectedVoterId],
      };
    });
  };

  const resetVotes = () => {
    if (!confirm("후보 투표 섹션을 하드 리셋할까요? 모든 후보의 투표자 목록이 비워집니다.")) return;
    setData((current) => ({
      ...current,
      votes: current.votes.map((topic) => ({
        ...topic,
        candidates: topic.candidates.map((candidate) => ({ ...candidate, voterIds: [] })),
      })),
    }));
  };

  const openPlaceModal = async (topicId: string, candidateId: string) => {
    const topic = data.votes.find((item) => item.id === topicId);
    const candidate = topic?.candidates.find((item) => item.id === candidateId);
    const initialQuery = candidate?.placeDetail?.query || candidate?.title || "";
    const requestId = ++placeSearchRequestId.current;

    setPlaceModalTarget({ topicId, candidateId });
    setPlaceQuery(initialQuery);
    setPlaceResults([]);
    setPlaceError("");
    setPlaceLoading(true);

    try {
      const results = await searchPlaceDetails(initialQuery);
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceResults(results);
      if (!results.length) {
        setPlaceError("검색 결과가 없어요. 영문명이나 Fukuoka를 붙여 다시 시도해보세요.");
      }
    } catch (error) {
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceResults([]);
      setPlaceError(error instanceof Error ? error.message : "가게 상세 검색에 실패했어요.");
    } finally {
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceLoading(false);
    }
  };

  const runPlaceSearch = async (event?: FormEvent) => {
    event?.preventDefault();
    const query = placeQuery.trim();
    const requestId = ++placeSearchRequestId.current;
    if (!query) {
      setPlaceResults([]);
      setPlaceError("검색어를 입력해 주세요.");
      return;
    }

    setPlaceLoading(true);
    setPlaceError("");

    try {
      const results = await searchPlaceDetails(query);
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceResults(results);
      if (!results.length) {
        setPlaceError("검색 결과가 없어요. 영문명이나 Fukuoka를 붙여 다시 시도해보세요.");
      }
    } catch (error) {
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceResults([]);
      setPlaceError(error instanceof Error ? error.message : "가게 상세 검색에 실패했어요.");
    } finally {
      if (placeSearchRequestId.current !== requestId) return;
      setPlaceLoading(false);
    }
  };

  const attachPlaceDetail = (detail: PlaceDetail) => {
    if (!placeModalTarget) return;

    updateCandidate(placeModalTarget.topicId, placeModalTarget.candidateId, (candidate) => ({
      ...candidate,
      placeDetail: detail,
    }));

    setPlaceModalTarget(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setPlaceError("");
    setPlaceLoading(false);
  };

  const clearPlaceDetail = (topicId: string, candidateId: string) => {
    if (!confirm("연결된 가게 상세를 해제할까요?")) return;
    updateCandidate(topicId, candidateId, (candidate) => ({
      ...candidate,
      placeDetail: undefined,
    }));
  };

  const closePlaceModal = () => {
    placeSearchRequestId.current += 1;
    setPlaceModalTarget(null);
    setPlaceQuery("");
    setPlaceResults([]);
    setPlaceError("");
    setPlaceLoading(false);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white shadow-sm" aria-label="뒤로">
            <ArrowLeft size={20} />
          </button>
          <div className="min-w-0">
            <p className="text-sm font-bold text-teal-600">후보 투표</p>
            <h1 className="break-words text-2xl font-black text-slate-900">후쿠오카 후보 고르기 🍜</h1>
          </div>
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            onClick={resetVotes}
            className="grid h-12 w-12 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
            aria-label="후보 투표 섹션 하드 리셋"
          >
            <RotateCcw size={19} />
          </button>
          {data.votes.length > 0 && (
            <button
              type="button"
              onClick={deleteAllVotes}
              className="grid h-12 w-12 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
              aria-label="후보 투표 항목 전체 삭제"
            >
              <Trash2 size={19} />
            </button>
          )}
          <button
            type="button"
            onClick={() => setTopicModalOpen(true)}
            className="flex h-12 items-center gap-2 rounded-lg bg-teal-500 px-3 font-bold text-white shadow-soft"
          >
            <Plus size={18} />
            항목
          </button>
        </div>
      </header>

      <Card>
        <label className="block">
          <span className="text-sm font-bold text-slate-700">투표할 사람 선택</span>
          <select
            value={selectedVoterId}
            onChange={(event) => setSelectedVoterId(event.target.value)}
            className="mt-2 h-12 w-full rounded-lg border border-slate-200 px-3"
          >
            {data.participants.map((participant) => (
              <option key={participant.id} value={participant.id}>
                {participant.name}
              </option>
            ))}
          </select>
        </label>
      </Card>

      <Card className="bg-teal-50/70">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-white text-teal-600 shadow-sm">
            <ExternalLink size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-black text-slate-900">투표와 지도 연결</p>
            <p className="mt-1 text-sm text-slate-600">
              옵션을 누르면 바로 투표되고, 아래 가게 검색 버튼으로 OpenStreetMap / Nominatim 공개 API에서 주소, 전화, 영업시간, 지도를 붙일 수 있어요.
            </p>
          </div>
        </div>
      </Card>

      {data.votes.length ? (
        <div className="space-y-3">
          {data.votes.map((topic) => {
            const maxVotes = Math.max(1, ...topic.candidates.map((candidate) => candidate.voterIds.length));
            return (
              <Card key={topic.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <span className="rounded-full bg-sky-100 px-2 py-1 text-xs font-black text-sky-700">{topic.category}</span>
                    <h2 className="mt-2 break-words text-lg font-black text-slate-900">{topic.title}</h2>
                    {topic.description && <p className="mt-1 whitespace-pre-wrap break-words text-sm text-slate-500">{topic.description}</p>}
                  </div>
                  <button
                    type="button"
                    onClick={() => deleteTopic(topic.id)}
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"
                    aria-label="투표 항목 삭제"
                  >
                    <Trash2 size={17} />
                  </button>
                </div>

                <div className="mt-4 space-y-3">
                  {topic.candidates.length ? (
                    topic.candidates.map((candidate, candidateIndex) => {
                      const voted = candidate.voterIds.includes(selectedVoterId);
                      const percent = Math.round((candidate.voterIds.length / maxVotes) * 100);
                      const voters = candidate.voterIds.map((id) => participantById.get(id)?.name ?? "알 수 없음");
                      return (
                        <div key={candidate.id} className="rounded-xl border border-slate-100 bg-white p-3 shadow-sm">
                          <button
                            type="button"
                            onClick={() => toggleVote(topic.id, candidate.id)}
                            className={`w-full rounded-xl p-3 text-left transition ${
                              voted ? "bg-teal-50 ring-1 ring-teal-200" : "bg-slate-50/80 hover:bg-slate-100"
                            }`}
                          >
                            <div className="flex items-start gap-3">
                              <div
                                className={`grid h-8 w-8 shrink-0 place-items-center rounded-full border text-sm font-black ${
                                  voted ? "border-teal-500 bg-teal-500 text-white" : "border-slate-300 bg-white text-slate-400"
                                }`}
                              >
                                {voted ? <Check size={16} /> : candidateIndex + 1}
                              </div>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="break-words text-base font-black text-slate-900">{candidate.title}</p>
                                    <p className="mt-1 break-words text-xs text-slate-500">
                                      {candidate.voterIds.length
                                        ? `${voters.join(", ")}가 선택함`
                                        : "아직 투표 없음"}
                                    </p>
                                  </div>
                                  <div className="shrink-0 text-right">
                                    <p className="text-base font-black text-teal-700">{candidate.voterIds.length}표</p>
                                    <p className="text-[11px] font-semibold text-slate-400">{percent}%</p>
                                  </div>
                                </div>

                                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/90">
                                  <div className={`h-full rounded-full ${voted ? "bg-teal-500" : "bg-slate-300"}`} style={{ width: `${percent}%` }} />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2">
                                  {candidate.voterIds.length ? (
                                    voters.slice(0, 4).map((name) => (
                                      <span key={name} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600 shadow-sm">
                                        {name}
                                      </span>
                                    ))
                                  ) : (
                                    <span className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-400 shadow-sm">
                                      투표자 없음
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </button>

                          {candidate.placeDetail ? (
                            <PlaceDetailPanel
                              detail={candidate.placeDetail}
                              onEdit={() => {
                                void openPlaceModal(topic.id, candidate.id);
                              }}
                              onClear={() => clearPlaceDetail(topic.id, candidate.id)}
                            />
                          ) : (
                            <div className="mt-3 rounded-lg border border-dashed border-teal-200 bg-teal-50/70 p-3">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-slate-900">가게 상세 미연결</p>
                                  <p className="mt-1 text-xs leading-5 text-slate-500">
                                    지도 검색으로 주소, 전화, 영업시간을 붙일 수 있어요.
                                  </p>
                                </div>
                                <span className="rounded-full bg-white px-2 py-1 text-[11px] font-black text-teal-700 shadow-sm">
                                  지도 검색
                                </span>
                              </div>
                              <button
                                type="button"
                                onClick={() => {
                                  void openPlaceModal(topic.id, candidate.id);
                                }}
                                className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-white font-bold text-teal-700 shadow-sm"
                              >
                                <Search size={16} />
                                가게 지도 검색
                              </button>
                            </div>
                          )}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <button
                              type="button"
                              onClick={() => {
                                void openPlaceModal(topic.id, candidate.id);
                              }}
                              className="h-9 rounded-lg bg-slate-900 px-3 text-xs font-black text-white"
                            >
                              가게 검색
                            </button>
                            {candidate.placeDetail && (
                              <button
                                type="button"
                                onClick={() => clearPlaceDetail(topic.id, candidate.id)}
                                className="h-9 rounded-lg bg-white px-3 text-xs font-black text-rose-600 shadow-sm"
                              >
                                상세 해제
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => deleteCandidate(topic.id, candidate.id)}
                              className="h-9 rounded-lg bg-white px-3 text-xs font-black text-slate-500 shadow-sm"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <EmptyState icon="🏮" title="후보가 없어요" description="신신라멘, 이치란, 다자이후 같은 후보를 추가해보세요." />
                  )}
                </div>

                {topic.linkMemo && (
                  <p className="mt-3 whitespace-pre-wrap break-words rounded-lg bg-slate-50 p-3 text-sm text-slate-600">
                    링크 메모 · {topic.linkMemo}
                  </p>
                )}

                <button
                  type="button"
                  onClick={() => setCandidateTopicId(topic.id)}
                  className="mt-3 h-11 w-full rounded-lg bg-slate-900 font-black text-white"
                >
                  후보 추가
                </button>
              </Card>
            );
          })}
        </div>
      ) : (
        <EmptyState icon="🍻" title="투표 항목이 없어요" description="숙소, 식당, 이자카야 후보부터 만들어보세요." />
      )}

      <Modal title="투표 항목 추가" open={topicModalOpen} onClose={() => setTopicModalOpen(false)}>
        <form onSubmit={saveTopic} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">제목</span>
            <input
              value={topicForm.title}
              onChange={(event) => setTopicForm((current) => ({ ...current, title: event.target.value }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">카테고리</span>
            <select
              value={topicForm.category}
              onChange={(event) => setTopicForm((current) => ({ ...current, category: event.target.value as VoteCategory }))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {categories.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">설명</span>
            <textarea
              value={topicForm.description}
              onChange={(event) => setTopicForm((current) => ({ ...current, description: event.target.value }))}
              rows={3}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">링크 메모</span>
            <textarea
              value={topicForm.linkMemo}
              onChange={(event) => setTopicForm((current) => ({ ...current, linkMemo: event.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-200 p-3"
            />
          </label>
          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </form>
      </Modal>

      <Modal
        title={`가게 상세 연결 · ${placeTargetCandidate?.candidate?.title ?? "후보"}`}
        open={Boolean(placeModalTarget)}
        onClose={closePlaceModal}
      >
        <div className="space-y-3">
          <p className="text-sm leading-6 text-slate-600">
            후보 이름이나 영문 가게명을 검색하면 주소, 전화, 영업시간, 지도 링크까지 붙일 수 있어요.
            잘 안 나오면 <span className="font-bold text-slate-900">Fukuoka</span>를 붙여 다시 검색해 보세요.
          </p>

          {placeTargetCandidate?.candidate?.placeDetail && (
            <div className="rounded-lg border border-teal-100 bg-teal-50/60 p-3">
              <p className="text-xs font-black text-teal-600">현재 연결된 상세</p>
              <p className="mt-1 break-words font-black text-slate-900">{placeTargetCandidate.candidate.placeDetail.name}</p>
              <p className="mt-1 break-words text-xs text-slate-600">{placeTargetCandidate.candidate.placeDetail.address}</p>
            </div>
          )}

          <form onSubmit={runPlaceSearch} className="space-y-3">
            <label className="block">
              <span className="text-sm font-bold text-slate-700">검색어</span>
              <input
                value={placeQuery}
                onChange={(event) => setPlaceQuery(event.target.value)}
                placeholder="예: Shin Shin, Ichiran, Canal City Hakata"
                className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
              />
            </label>
            <button
              type="submit"
              disabled={placeLoading}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-500 font-black text-white disabled:opacity-70"
            >
              {placeLoading ? <Loader2 size={18} className="animate-spin" /> : <Search size={18} />}
              검색
            </button>
          </form>

          {placeError && <div className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{placeError}</div>}

          {placeLoading && (
            <div className="flex items-center gap-2 rounded-lg bg-slate-50 p-3 text-sm font-bold text-slate-600">
              <Loader2 size={16} className="animate-spin" />
              가게 상세를 찾는 중...
            </div>
          )}

          {placeResults.length > 0 ? (
            <div className="space-y-3">
              <p className="text-sm font-black text-slate-700">검색 결과</p>
              {placeResults.map((detail) => (
                <button
                  key={`${detail.osmType}-${detail.osmId}-${detail.placeId}`}
                  type="button"
                  onClick={() => attachPlaceDetail(detail)}
                  className="w-full rounded-lg border border-slate-100 bg-white p-3 text-left shadow-sm"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="break-words font-black text-slate-900">{detail.name}</p>
                      <p className="mt-1 break-words text-xs text-slate-500">{detail.address}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-teal-50 px-2 py-1 text-[11px] font-black text-teal-700">
                      {detail.countryCode.toUpperCase()}
                    </span>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">
                      {formatPlaceType(detail)}
                    </span>
                    {detail.phone && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">전화 있음</span>
                    )}
                    {detail.website && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">홈페이지 있음</span>
                    )}
                    {detail.openingHours && (
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600">영업시간 있음</span>
                    )}
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                    <span className="break-words">
                      좌표 {formatCoord(detail.latitude)}, {formatCoord(detail.longitude)}
                    </span>
                    <div className="flex shrink-0 items-center gap-2">
                      <a
                        href={detail.mapUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 rounded-full bg-teal-50 px-2 py-1 font-black text-teal-700"
                      >
                        <MapPin size={12} />
                        지도 열기
                      </a>
                      <span className="font-black text-teal-700">등록하기</span>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            !placeLoading &&
            !placeError && (
              <EmptyState
                icon="🏮"
                title="검색 결과를 기다리는 중"
                description="검색 버튼을 눌러 가게 상세를 불러와보세요."
              />
            )
          )}
        </div>
      </Modal>

      <Modal title="후보 추가" open={Boolean(candidateTopicId)} onClose={() => setCandidateTopicId(null)}>
        <form onSubmit={saveCandidate} className="space-y-3">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">후보 이름</span>
            <input
              value={candidateTitle}
              onChange={(event) => setCandidateTitle(event.target.value)}
              placeholder="예: 오호리공원"
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            />
          </label>
          <button type="submit" className="h-12 w-full rounded-lg bg-teal-500 font-black text-white">
            저장
          </button>
        </form>
      </Modal>
    </div>
  );
}
