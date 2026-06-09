"use client";

import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "sqp_photos";

type PhotoStore = Record<string, string>; // objectiveId → data URL

function getStoredPhotos(): PhotoStore {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PhotoStore;
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

function getServerSnapshot(): PhotoStore {
  return {};
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

  const savePhoto = useCallback(async (objectiveId: string, file: File) => {
    const compressed = await compressImage(file);
    const current = getStoredPhotos();
    setStoredPhotos({ ...current, [objectiveId]: compressed });
    return compressed;
  }, []);

  const getPhoto = useCallback(
    (objectiveId: string): string | null => {
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

  return { photos, savePhoto, getPhoto, removePhoto, hasPhoto };
}
