import type { PhotoLibraryItem } from "../types";
import type { CloudConfig } from "./cloudSync";
import { buildHeaders, SYNC_ROOM_ID, SYNC_TABLE } from "./cloudSync";

const PHOTO_ROW_PREFIX = `${SYNC_ROOM_ID}-photo-`;
const DELETED_PHOTO_ROW_PREFIX = `${SYNC_ROOM_ID}-deleted-photo-`;
const PHOTO_PAGE_SIZE = 20;

type SharedPhotoPayload = {
  type: "shared_photo";
  photo: PhotoLibraryItem;
};

type DeletedSharedPhotoPayload = {
  type: "deleted_shared_photo";
  photoId: string;
  deletedAt: string;
};

type SharedPhotoRow = {
  id: string;
  payload: SharedPhotoPayload | DeletedSharedPhotoPayload;
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

const isDeletedSharedPhotoPayload = (value: unknown): value is DeletedSharedPhotoPayload => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<DeletedSharedPhotoPayload>;
  return candidate.type === "deleted_shared_photo" && typeof candidate.photoId === "string";
};

const buildPhotoRowId = (photoId: string) => `${PHOTO_ROW_PREFIX}${photoId}`;
const buildDeletedPhotoRowId = (photoId: string) => `${DELETED_PHOTO_ROW_PREFIX}${photoId}`;

const buildQuery = (params: Record<string, string>) => new URLSearchParams(params).toString();

const listSharedPhotoRowsByPrefix = async (config: CloudConfig, prefix: string) => {
  const rows: SharedPhotoRow[] = [];

  for (let offset = 0; ; offset += PHOTO_PAGE_SIZE) {
    const query = buildQuery({
      select: "id,payload,updated_at",
      id: `like.${prefix}*`,
      order: "id.asc",
      limit: String(PHOTO_PAGE_SIZE),
      offset: String(offset),
    });

    const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?${query}`, {
      headers: buildHeaders(config.anonKey),
    });

    if (!response.ok) {
      throw new Error(`공용 사진 목록을 불러오지 못했어요. (${response.status})`);
    }

    const page = (await response.json()) as SharedPhotoRow[];
    rows.push(...page);

    if (page.length < PHOTO_PAGE_SIZE) {
      break;
    }
  }

  return rows;
};

export const listDeletedSharedPhotoIds = async (config: CloudConfig) => {
  const rows = await listSharedPhotoRowsByPrefix(config, DELETED_PHOTO_ROW_PREFIX);
  const deletedPhotoIds = new Set<string>();

  for (const row of rows) {
    if (isDeletedSharedPhotoPayload(row.payload)) {
      deletedPhotoIds.add(row.payload.photoId);
    }
  }

  return deletedPhotoIds;
};

export const listSharedPhotos = async (config: CloudConfig, knownDeletedPhotoIds?: Set<string>) => {
  const deletedPhotoIds = knownDeletedPhotoIds ?? (await listDeletedSharedPhotoIds(config));
  const rows = await listSharedPhotoRowsByPrefix(config, PHOTO_ROW_PREFIX);
  const photos: PhotoLibraryItem[] = [];

  for (const row of rows) {
    if (isSharedPhotoPayload(row.payload)) {
      photos.push(row.payload.photo);
    }
  }

  return photos
    .filter((photo) => !deletedPhotoIds.has(photo.id))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
};

const markSharedPhotosDeleted = async (config: CloudConfig, photoIds: string[]) => {
  const deletedAt = new Date().toISOString();

  for (const photoId of photoIds) {
    const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?on_conflict=id`, {
      method: "POST",
      headers: {
        ...buildHeaders(config.anonKey),
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({
        id: buildDeletedPhotoRowId(photoId),
        payload: {
          type: "deleted_shared_photo",
          photoId,
          deletedAt,
        } satisfies DeletedSharedPhotoPayload,
        updated_at: deletedAt,
      }),
    });

    if (!response.ok) {
      throw new Error(`공용 사진 삭제 기록 저장에 실패했어요. (${response.status})`);
    }
  }
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
  await markSharedPhotosDeleted(config, [photoId]);

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

  await markSharedPhotosDeleted(config, targets.map((photo) => photo.id));

  for (const photo of targets) {
    const query = buildQuery({ id: `eq.${buildPhotoRowId(photo.id)}` });
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
  }
};

export const clearSharedPhotos = async (config: CloudConfig) => {
  const photos = await listSharedPhotos(config);

  await markSharedPhotosDeleted(config, photos.map((photo) => photo.id));

  for (const photo of photos) {
    const query = buildQuery({ id: `eq.${buildPhotoRowId(photo.id)}` });
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
  }
};
