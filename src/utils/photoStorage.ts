import type { PhotoLibraryItem } from "../types";

const DB_NAME = "deu-10th-fukuoka-trip-photos";
const STORE_NAME = "photo-library";
const DB_VERSION = 1;

const openDatabase = () =>
  new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("이 브라우저에서는 사진 저장을 지원하지 않아요."));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("사진 저장소를 열지 못했어요."));
  });

const withStore = async <T>(mode: IDBTransactionMode, task: (store: IDBObjectStore) => Promise<T>) => {
  const database = await openDatabase();

  try {
    const transaction = database.transaction(STORE_NAME, mode);
    const store = transaction.objectStore(STORE_NAME);
    const result = await task(store);

    await new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject(transaction.error ?? new Error("사진 저장 중 오류가 났어요."));
      transaction.onabort = () => reject(transaction.error ?? new Error("사진 저장이 중단됐어요."));
    });

    return result;
  } finally {
    database.close();
  }
};

const requestToPromise = <T>(request: IDBRequest<T>) =>
  new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("사진 저장 요청이 실패했어요."));
  });

export const loadPhotoLibrary = async () =>
  await withStore("readonly", async (store) => {
    const photos = await requestToPromise(store.getAll() as IDBRequest<PhotoLibraryItem[]>);
    return photos.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  });

export const savePhotoLibraryItems = async (items: PhotoLibraryItem[]) => {
  await withStore("readwrite", async (store) => {
    for (const item of items) {
      await requestToPromise(store.put(item));
    }
  });
};

export const replacePhotoLibrary = async (items: PhotoLibraryItem[]) => {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.clear());
    for (const item of items) {
      await requestToPromise(store.put(item));
    }
  });
};

export const deletePhotoLibraryItem = async (photoId: string) => {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.delete(photoId));
  });
};

export const deletePhotoLibraryByYear = async (year: number) => {
  const photos = await loadPhotoLibrary();
  const remaining = photos.filter((photo) => photo.year !== year);
  await replacePhotoLibrary(remaining);
};

export const clearPhotoLibrary = async () => {
  await withStore("readwrite", async (store) => {
    await requestToPromise(store.clear());
  });
};

export const isQuotaExceededError = (error: unknown) =>
  error instanceof DOMException &&
  (error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED");
