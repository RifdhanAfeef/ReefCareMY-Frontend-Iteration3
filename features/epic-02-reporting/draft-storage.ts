export type StoredDraftPhoto = {
  id: string;
  file: File;
};

import { readStoredAuth } from "@/lib/api/token-store";

const databaseNamePrefix = "reefcare-my-drafts-v2";
const storeName = "report-photos";

export function draftPhotoDatabaseName(userId: number | null) {
  return `${databaseNamePrefix}-${userId ?? "anonymous"}`;
}

export function createPhotoId(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = window.indexedDB.open(
      draftPhotoDatabaseName(readStoredAuth()?.user.id ?? null),
      1,
    );
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(storeName)) {
        database.createObjectStore(storeName, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export async function loadDraftPhotos() {
  const database = await openDatabase();
  return new Promise<StoredDraftPhoto[]>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readonly");
    const request = transaction.objectStore(storeName).getAll();
    request.onsuccess = () => resolve(request.result as StoredDraftPhoto[]);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
  });
}

export async function saveDraftPhotos(photos: StoredDraftPhoto[]) {
  const database = await openDatabase();
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(storeName, "readwrite");
    const store = transaction.objectStore(storeName);
    store.clear();
    photos.forEach((photo) => store.put(photo));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function clearDraftPhotos() {
  await saveDraftPhotos([]);
}
