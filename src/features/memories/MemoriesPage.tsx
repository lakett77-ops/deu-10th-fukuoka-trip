import { ChangeEvent, Dispatch, SetStateAction, useMemo, useRef, useState } from "react";
import { ArrowLeft, ImagePlus, Trash2, X } from "lucide-react";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import Modal from "../../components/Modal";
import type { PhotoLibraryItem, TravelAppData } from "../../types";
import { createId } from "../../utils/id";
import {
  clearPhotoLibrary,
  deletePhotoLibraryByYear,
  deletePhotoLibraryItem,
  isQuotaExceededError,
  savePhotoLibraryItems,
} from "../../utils/photoStorage";

interface MemoriesPageProps {
  data: TravelAppData;
  setData: Dispatch<SetStateAction<TravelAppData>>;
  onBack: () => void;
}

const years = Array.from({ length: 11 }, (_, index) => 2016 + index);
const allYears = "전체";
type YearFilter = typeof allYears | number;

const resizeImage = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const maxSide = 960;
        const scale = Math.min(1, maxSide / Math.max(image.width, image.height));
        const width = Math.max(1, Math.round(image.width * scale));
        const height = Math.max(1, Math.round(image.height * scale));
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("이미지를 처리할 수 없어요."));
          return;
        }

        context.drawImage(image, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", 0.68));
      };

      image.onerror = () => reject(new Error("지원하지 않는 이미지 형식이에요."));
      image.src = String(reader.result);
    };

    reader.onerror = () => reject(new Error("사진을 읽지 못했어요."));
    reader.readAsDataURL(file);
  });

const getPhotoUploadErrorMessage = (error: unknown) => {
  if (isQuotaExceededError(error)) {
    return "사진 저장 공간이 가득 찼어요. 기존 사진을 조금 지우고 다시 올려주세요.";
  }

  return error instanceof Error ? error.message : "사진 업로드에 실패했어요.";
};

export default function MemoriesPage({ data, setData, onBack }: MemoriesPageProps) {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [selectedYear, setSelectedYear] = useState<YearFilter>(allYears);
  const [uploadYear, setUploadYear] = useState(2026);
  const [uploaderId, setUploaderId] = useState(data.participants[0]?.id ?? "");
  const [previewPhoto, setPreviewPhoto] = useState<PhotoLibraryItem | null>(null);
  const [uploading, setUploading] = useState(false);

  const participantById = useMemo(
    () => new Map(data.participants.map((participant) => [participant.id, participant])),
    [data.participants],
  );
  const photos = data.photoLibrary ?? [];
  const visiblePhotos = photos
    .filter((photo) => selectedYear === allYears || photo.year === selectedYear)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith("image/"));
    if (!files.length) return;

    setUploading(true);
    try {
      const uploadedPhotos = await Promise.all(
        files.map(async (file) => ({
          id: createId("photo-library"),
          year: uploadYear,
          imageDataUrl: await resizeImage(file),
          fileName: file.name,
          uploadedById: uploaderId,
          createdAt: new Date().toISOString(),
        })),
      );

      await savePhotoLibraryItems(uploadedPhotos);

      setData((current) => ({
        ...current,
        photoLibrary: [...uploadedPhotos, ...(current.photoLibrary ?? [])],
      }));
    } catch (error) {
      alert(getPhotoUploadErrorMessage(error));
    } finally {
      setUploading(false);
      event.target.value = "";
    }
  };

  const deletePhoto = async (photoId: string) => {
    if (!confirm("이 사진을 삭제할까요?")) return;
    await deletePhotoLibraryItem(photoId);
    setData((current) => ({
      ...current,
      photoLibrary: (current.photoLibrary ?? []).filter((photo) => photo.id !== photoId),
    }));
    setPreviewPhoto((current) => (current?.id === photoId ? null : current));
  };

  const deleteAllPhotos = async () => {
    if (!confirm("사진 라이브러리의 모든 사진을 삭제할까요?")) return;
    await clearPhotoLibrary();
    setData((current) => ({
      ...current,
      photoLibrary: [],
    }));
    setPreviewPhoto(null);
  };

  const deleteSelectedYearPhotos = async () => {
    if (selectedYear === allYears) return;
    if (!confirm(`${selectedYear}년 사진을 전체 삭제할까요?`)) return;
    await deletePhotoLibraryByYear(selectedYear);
    setData((current) => ({
      ...current,
      photoLibrary: (current.photoLibrary ?? []).filter((photo) => photo.year !== selectedYear),
    }));
    setPreviewPhoto(null);
  };

  return (
    <div className="space-y-4">
      <header className="flex items-center gap-3">
        <button type="button" onClick={onBack} className="grid h-11 w-11 place-items-center rounded-lg bg-white shadow-sm" aria-label="뒤로">
          <ArrowLeft size={20} />
        </button>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-teal-600">사진/추억</p>
          <h1 className="text-2xl font-black text-slate-900">친구들 사진 라이브러리</h1>
        </div>
        {photos.length > 0 && (
          <button
            type="button"
            onClick={deleteAllPhotos}
            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-white text-rose-600 shadow-sm"
            aria-label="사진 라이브러리 전체 삭제"
          >
            <Trash2 size={19} />
          </button>
        )}
      </header>

      <Card className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <label className="block">
            <span className="text-sm font-bold text-slate-700">사진 연도</span>
            <select
              value={uploadYear}
              onChange={(event) => setUploadYear(Number(event.target.value))}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {years.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-sm font-bold text-slate-700">올린 사람</span>
            <select
              value={uploaderId}
              onChange={(event) => setUploaderId(event.target.value)}
              className="mt-1 h-12 w-full rounded-lg border border-slate-200 px-3"
            >
              {data.participants.map((participant) => (
                <option key={participant.id} value={participant.id}>
                  {participant.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFiles} />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-500 font-black text-white disabled:bg-slate-300"
        >
          <ImagePlus size={19} />
          {uploading ? "사진 올리는 중" : "사진 올리기"}
        </button>
        <p className="text-xs font-bold text-slate-500">
          사진은 용량 문제 때문에 이 기기 브라우저에 따로 저장돼요. 일정이나 정산과 달리 사진은 아직 기기별로 관리됩니다.
        </p>
      </Card>

      <section className="space-y-3">
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setSelectedYear(allYears)}
            className={`h-10 shrink-0 rounded-lg px-3 text-sm font-black ${
              selectedYear === allYears ? "bg-slate-900 text-white" : "bg-white text-slate-600"
            }`}
          >
            전체 {photos.length}
          </button>
          {years.map((year) => {
            const count = photos.filter((photo) => photo.year === year).length;
            return (
              <button
                key={year}
                type="button"
                onClick={() => setSelectedYear(year)}
                className={`h-10 shrink-0 rounded-lg px-3 text-sm font-black ${
                  selectedYear === year ? "bg-teal-500 text-white" : "bg-white text-slate-600"
                }`}
              >
                {year} {count}
              </button>
            );
          })}
        </div>

        {selectedYear !== allYears && visiblePhotos.length > 0 && (
          <button
            type="button"
            onClick={deleteSelectedYearPhotos}
            className="h-10 w-full rounded-lg bg-rose-50 text-sm font-black text-rose-600"
          >
            {selectedYear}년 사진 전체 삭제
          </button>
        )}

        {visiblePhotos.length ? (
          <div className="grid grid-cols-2 gap-3">
            {visiblePhotos.map((photo) => {
              const uploader = participantById.get(photo.uploadedById);
              return (
                <article key={photo.id} className="overflow-hidden rounded-lg bg-white shadow-soft">
                  <button type="button" onClick={() => setPreviewPhoto(photo)} className="block w-full">
                    <img src={photo.imageDataUrl} alt={photo.fileName} className="aspect-square w-full object-cover" />
                  </button>
                  <div className="space-y-2 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-black text-slate-900">{photo.year}</p>
                        <p className="truncate text-xs font-bold text-slate-500">{uploader?.name ?? "알 수 없음"}</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => deletePhoto(photo.id)}
                        className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-rose-50 text-rose-600"
                        aria-label="사진 삭제"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <EmptyState icon="📸" title="아직 올라온 사진이 없어요" description="연도를 고르고 사진을 올리면 여기서 같이 볼 수 있어요." />
        )}
      </section>

      <Modal title="사진 보기" open={Boolean(previewPhoto)} onClose={() => setPreviewPhoto(null)}>
        {previewPhoto && (
          <div className="space-y-3">
            <img src={previewPhoto.imageDataUrl} alt={previewPhoto.fileName} className="max-h-[58vh] w-full rounded-lg object-contain bg-slate-100" />
            <div className="rounded-lg bg-slate-50 p-3">
              <p className="font-black text-slate-900">{previewPhoto.year}년 사진</p>
              <p className="mt-1 text-sm font-bold text-slate-500">
                올린 사람 · {participantById.get(previewPhoto.uploadedById)?.name ?? "알 수 없음"}
              </p>
              <p className="mt-1 break-words text-xs text-slate-400">{previewPhoto.fileName}</p>
            </div>
            <button
              type="button"
              onClick={() => setPreviewPhoto(null)}
              className="flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-slate-900 font-black text-white"
            >
              <X size={18} />
              닫기
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
