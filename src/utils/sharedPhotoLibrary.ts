import type { PhotoLibraryItem } from "../types";
import type { CloudConfig } from "./cloudSync";
import { buildHeaders, SYNC_ROOM_ID, SYNC_TABLE } from "./cloudSync";

const PHOTO_ROW_PREFIX = `${SYNC_ROOM_ID}-photo-`;

type SharedPhotoPayload = {
  type: "shared_photo";
  photo: PhotoLibraryItem;
};

type SharedPhotoRow = {
  id: string;
  payload: SharedPhotoPayload;
  updated_at: string;
};

const isPhotoLibraryItem = (value: unknown): value is PhotoLibraryItem => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<PhotoLibraryItem>;
  return Boolean(
    candidate.id &&
      typeof candidate.year === "number" &&
      typeof candidate.imageDataUrl === "string" &&
      typeof candidate.fileName === "string" &&
      typeof candidate.uploadedById === "string" &&
      typeof candidate.createdAt === "string",
  );
};

const isSharedPhotoPayload = (value: unknown): value is SharedPhotoPayload => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<SharedPhotoPayload>;
  return candidate.type === "shared_photo" && isPhotoLibraryItem(candidate.photo);
};

const buildPhotoRowId = (photoId: string) => `${PHOTO_ROW_PREFIX}${photoId}`;

const buildQuery = (params: Record<string, string>) => new URLSearchParams(params).toString();

export const listSharedPhotos = async (config: CloudConfig) => {
  const query = buildQuery({
    select: "id,payload,updated_at",
    order: "updated_at.desc",
    id: `like.${PHOTO_ROW_PREFIX}*`,
  });

  const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?${query}`, {
    headers: buildHeaders(config.anonKey),
  });

  if (!response.ok) {
    throw new Error(`공용 사진 목록을 불러오지 못했어요. (${response.status})`);
  }

  const rows = (await response.json()) as SharedPhotoRow[];
  return rows
    .filter((row) => isSharedPhotoPayload(row.payload))
    .map((row) => row.payload.photo)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

export const uploadSharedPhotos = async (config: CloudConfig, photos: PhotoLibraryItem[]) => {
  for (const photo of photos) {
    const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...buildHeaders(config.anonKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: buildPhotoRowId(photo.id),
        payload: {
          type: "shared_photo",
          photo,
        } satisfies SharedPhotoPayload,
        updated_at: new Date().toISOString(),
      }),
    });

    if (!response.ok) {
      throw new Error(`공용 사진 업로드에 실패했어요. (${response.status})`);
    }
  }
};

export const deleteSharedPhoto = async (config: CloudConfig, photoId: string) => {
  const query = buildQuery({ id: `eq.${buildPhotoRowId(photoId)}` });
  const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?${query}`, {
    method: "DELETE",
    headers: {
      ...buildHeaders(config.anonKey),
      Prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    throw new Error(`공용 사진 삭제에 실패했어요. (${response.status})`);
  }
};

export const deleteSharedPhotosByYear = async (config: CloudConfig, year: number) => {
  const photos = await listSharedPhotos(config);
  const targets = photos.filter((photo) => photo.year === year);

  for (const photo of targets) {
    await deleteSharedPhoto(config, photo.id);
  }
};

export const clearSharedPhotos = async (config: CloudConfig) => {
  const photos = await listSharedPhotos(config);

  for (const photo of photos) {
    await deleteSharedPhoto(config, photo.id);
  }
};
