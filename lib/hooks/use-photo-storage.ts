"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sqp_photos";

export type PhotoEntry = {
  dataUrl: string;
  /** true = AI verified, false = AI rejected, null = not verified (yet) */
  verified: boolean | null;
  /** One-liner from the AI judge, shown under the badge */
  reason: string | null;
  savedAt: string;
};

export type PhotoStore = Record<string, PhotoEntry>;

/**
 * v1 of this store kept plain data-URL strings. Normalize anything we
 * find in localStorage into a PhotoEntry so old photos survive the
 * upgrade; return null for junk.
 */
export function normalizePhotoEntry(raw: unknown): PhotoEntry | null {
  if (typeof raw === "string") {
    return raw.startsWith("data:image/")
      ? { dataUrl: raw, verified: null, reason: null, savedAt: "" }
      : null;
  }
  if (raw && typeof raw === "object" && "dataUrl" in raw) {
    const entry = raw as Partial<PhotoEntry>;
    if (
      typeof entry.dataUrl === "string" &&
      entry.dataUrl.startsWith("data:image/")
    ) {
      return {
        dataUrl: entry.dataUrl,
        verified: typeof entry.verified === "boolean" ? entry.verified : null,
        reason: typeof entry.reason === "string" ? entry.reason : null,
        savedAt: typeof entry.savedAt === "string" ? entry.savedAt : "",
      };
    }
  }
  return null;
}

export function countVerified(photos: PhotoStore): number {
  return Object.values(photos).filter((p) => p.verified === true).length;
}

function getStoredPhotos(): PhotoStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const store: PhotoStore = {};
    for (const [id, value] of Object.entries(parsed)) {
      const entry = normalizePhotoEntry(value);
      if (entry) store[id] = entry;
    }
    return store;
  } catch {
    return {};
  }
}

function setStoredPhotos(photos: PhotoStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(photos));
  window.dispatchEvent(new StorageEvent("storage", { key: STORAGE_KEY }));
}

let cachedPhotos: PhotoStore = {};

function subscribe(callback: () => void) {
  const handler = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY || e.key === null) {
      cachedPhotos = getStoredPhotos();
      callback();
    }
  };
  window.addEventListener("storage", handler);
  cachedPhotos = getStoredPhotos();
  return () => window.removeEventListener("storage", handler);
}

function getSnapshot() {
  return cachedPhotos;
}

const EMPTY_STORE: PhotoStore = {};

function getServerSnapshot(): PhotoStore {
  return EMPTY_STORE;
}

/**
 * Resize and compress an image file to fit in localStorage.
 * Max 800×800, JPEG quality 0.6 (~50-100KB per photo).
 */
function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(url);

      const MAX = 800;
      let { width, height } = img;

      if (width > MAX || height > MAX) {
        const ratio = Math.min(MAX / width, MAX / height);
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        reject(new Error("Canvas context unavailable"));
        return;
      }
      ctx.drawImage(img, 0, 0, width, height);

      const dataUrl = canvas.toDataURL("image/jpeg", 0.6);
      resolve(dataUrl);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };

    img.src = url;
  });
}

export function usePhotoStorage() {
  const photos = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  const savePhoto = useCallback(
    async (objectiveId: string, file: File): Promise<PhotoEntry> => {
      const dataUrl = await compressImage(file);
      const entry: PhotoEntry = {
        dataUrl,
        verified: null,
        reason: null,
        savedAt: new Date().toISOString(),
      };
      const current = getStoredPhotos();
      setStoredPhotos({ ...current, [objectiveId]: entry });
      return entry;
    },
    [],
  );

  const setVerification = useCallback(
    (objectiveId: string, verified: boolean, reason: string | null) => {
      const current = getStoredPhotos();
      const existing = current[objectiveId];
      if (!existing) return;
      setStoredPhotos({
        ...current,
        [objectiveId]: { ...existing, verified, reason },
      });
    },
    [],
  );

  const getPhoto = useCallback(
    (objectiveId: string): PhotoEntry | null => {
      return photos[objectiveId] ?? null;
    },
    [photos],
  );

  const removePhoto = useCallback((objectiveId: string) => {
    const current = getStoredPhotos();
    const { [objectiveId]: _, ...rest } = current;
    setStoredPhotos(rest);
  }, []);

  const hasPhoto = useCallback(
    (objectiveId: string): boolean => {
      return objectiveId in photos;
    },
    [photos],
  );

  return {
    photos,
    savePhoto,
    setVerification,
    getPhoto,
    removePhoto,
    hasPhoto,
    verifiedCount: countVerified(photos),
  };
}
