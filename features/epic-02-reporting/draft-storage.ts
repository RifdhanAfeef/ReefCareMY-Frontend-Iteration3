export type StoredDraftPhoto = {
  id: string;
  file: File;
  name?: string;
  type?: string;
  lastModified?: number;
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

// Some mobile browsers restore a stored File as a Blob. Keep its upload metadata.
export function restoreDraftPhoto(photo: StoredDraftPhoto): StoredDraftPhoto {
  const name = photo.name || photo.file.name || photo.id.replace(/-\d+-\d+$/, "");
  const type = photo.type || photo.file.type;
  const lastModified = photo.lastModified ?? photo.file.lastModified ?? 0;
  const file = photo.file instanceof File && photo.file.name === name && photo.file.type === type
    ? photo.file : new File([photo.file], name, { type, lastModified });
  return { id: photo.id, file };
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
    request.onsuccess = () => {
      try { resolve((request.result as StoredDraftPhoto[]).map(restoreDraftPhoto)); }
      catch (error) { reject(error); }
    };
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
    photos.forEach((photo) => store.put({ ...photo, name: photo.file.name, type: photo.file.type, lastModified: photo.file.lastModified }));
    transaction.oncomplete = () => { database.close(); resolve(); };
    transaction.onerror = () => { database.close(); reject(transaction.error); };
  });
}

export async function clearDraftPhotos() {
  await saveDraftPhotos([]);
}
