import { useEffect, useRef, useState } from "react";
import type { TravelAppData } from "../types";
import { loadTripData, stripPhotoLibraryFromData } from "../utils/storage";
import { loadPhotoLibrary, replacePhotoLibrary } from "../utils/photoStorage";

const SYNC_ROOM_ID = "deu-10th-fukuoka-trip";
const SYNC_TABLE = "trip_state";
const SYNC_POLL_MS = 3000;
const SYNC_DEBOUNCE_MS = 500;

type SyncState = "connecting" | "ready";

type TripRow = {
  id: string;
  payload: TravelAppData;
  updated_at: string;
};

const isTripData = (value: unknown): value is TravelAppData => {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Partial<TravelAppData>;
  return Boolean(
    candidate.settings &&
      Array.isArray(candidate.participants) &&
      Array.isArray(candidate.participantMessages) &&
      Array.isArray(candidate.schedules) &&
      Array.isArray(candidate.expenses) &&
      Array.isArray(candidate.preflightChecks) &&
      Array.isArray(candidate.checklists) &&
      Array.isArray(candidate.votes) &&
      Array.isArray(candidate.memories) &&
      Array.isArray(candidate.memberCards) &&
      Array.isArray(candidate.photoLinks) &&
      Array.isArray(candidate.photoLibrary),
  );
};

const mergeRemoteDataWithLocalPhotos = (remoteData: TravelAppData, localPhotos: TravelAppData["photoLibrary"]): TravelAppData => ({
  ...remoteData,
  photoLibrary: localPhotos,
});

const getCloudConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
};

const serialize = (value: TravelAppData) => JSON.stringify(stripPhotoLibraryFromData(value));

const buildHeaders = (anonKey: string) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Profile": "public",
  "Content-Profile": "public",
});

const readRemoteRow = async (config: { url: string; anonKey: string }) => {
  const response = await fetch(
    `${config.url}/rest/v1/${SYNC_TABLE}?id=eq.${SYNC_ROOM_ID}&select=id,payload,updated_at`,
    {
      headers: buildHeaders(config.anonKey),
    },
  );

  if (!response.ok) {
    throw new Error(`Remote read failed (${response.status})`);
  }

  const rows = (await response.json()) as TripRow[];
  return rows[0] ?? null;
};

const writeRemoteRow = async (config: { url: string; anonKey: string }, payload: TravelAppData) => {
  const sanitizedPayload = stripPhotoLibraryFromData(payload);
  const response = await fetch(`${config.url}/rest/v1/${SYNC_TABLE}?on_conflict=id`, {
    method: "POST",
    headers: {
      ...buildHeaders(config.anonKey),
      Prefer: "resolution=merge-duplicates,return=representation",
    },
    body: JSON.stringify({
      id: SYNC_ROOM_ID,
      payload: sanitizedPayload,
      updated_at: new Date().toISOString(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Remote write failed (${response.status})`);
  }

  const rows = (await response.json()) as TripRow[];
  return rows[0] ?? null;
};

export function useSharedTripData() {
  const [data, setData] = useState<TravelAppData>(() => loadTripData());
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const dataRef = useRef(data);
  const cloudConfigRef = useRef<ReturnType<typeof getCloudConfig>>(null);
  const lastPublishedRef = useRef("");
  const lastRemoteUpdatedAtRef = useRef("");
  const isReadyRef = useRef(false);
  const pollTimerRef = useRef<number | null>(null);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const indexedPhotos = await loadPhotoLibrary();
        if (cancelled) return;

        if (indexedPhotos.length > 0) {
          setData((current) => ({ ...current, photoLibrary: indexedPhotos }));
          return;
        }

        const legacyPhotos = dataRef.current.photoLibrary ?? [];
        if (!legacyPhotos.length) return;

        await replacePhotoLibrary(legacyPhotos);
        if (cancelled) return;
        setData((current) => ({ ...current, photoLibrary: legacyPhotos }));
      } catch (error) {
        console.warn("Photo library hydration failed:", error);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const config = getCloudConfig();
    cloudConfigRef.current = config;

    if (!config) {
      setSyncState("ready");
      return undefined;
    }

    let cancelled = false;

    const hydrate = async () => {
      try {
        const remoteRow = await readRemoteRow(config);

        if (cancelled) return;

        if (remoteRow?.payload && isTripData(remoteRow.payload)) {
          const remoteSerialized = serialize(remoteRow.payload);
          lastPublishedRef.current = remoteSerialized;
          lastRemoteUpdatedAtRef.current = remoteRow.updated_at;
          setData((current) => mergeRemoteDataWithLocalPhotos(remoteRow.payload, current.photoLibrary ?? []));
          if ((remoteRow.payload.photoLibrary?.length ?? 0) > 0) {
            void writeRemoteRow(config, remoteRow.payload).catch((cleanupError) => {
              console.warn("Remote photo payload cleanup failed:", cleanupError);
            });
          }
        } else {
          const seed = dataRef.current;
          const seedSerialized = serialize(seed);
          lastPublishedRef.current = seedSerialized;

          const createdRow = await writeRemoteRow(config, seed);
          if (createdRow?.updated_at) {
            lastRemoteUpdatedAtRef.current = createdRow.updated_at;
          }
        }

        if (cancelled) return;

        isReadyRef.current = true;
        setSyncState("ready");

        pollTimerRef.current = window.setInterval(() => {
          void (async () => {
            try {
              const latestRow = await readRemoteRow(config);
              if (!latestRow?.payload || !isTripData(latestRow.payload)) return;

              const latestSerialized = serialize(latestRow.payload);
              if (latestRow.updated_at === lastRemoteUpdatedAtRef.current) {
                return;
              }

              lastRemoteUpdatedAtRef.current = latestRow.updated_at;
              if (latestSerialized === lastPublishedRef.current) {
                return;
              }

              lastPublishedRef.current = latestSerialized;
              setData((current) => mergeRemoteDataWithLocalPhotos(latestRow.payload, current.photoLibrary ?? []));
              if ((latestRow.payload.photoLibrary?.length ?? 0) > 0) {
                void writeRemoteRow(config, latestRow.payload).catch((cleanupError) => {
                  console.warn("Remote photo payload cleanup failed:", cleanupError);
                });
              }
            } catch (pollError) {
              console.warn("Remote sync poll failed:", pollError);
            }
          })();
        }, SYNC_POLL_MS);
      } catch (error) {
        console.warn("Remote sync initialization failed:", error);
        isReadyRef.current = true;
        setSyncState("ready");
      }
    };

    void hydrate();

    return () => {
      cancelled = true;
      isReadyRef.current = false;
      if (pollTimerRef.current !== null) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const config = cloudConfigRef.current;
    if (!config || !isReadyRef.current) return undefined;

    const serialized = serialize(data);
    if (serialized === lastPublishedRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const writtenRow = await writeRemoteRow(config, data);
          lastPublishedRef.current = serialized;
          if (writtenRow?.updated_at) {
            lastRemoteUpdatedAtRef.current = writtenRow.updated_at;
          }
        } catch (publishError) {
          console.warn("Remote sync publish failed:", publishError);
        }
      })();
    }, SYNC_DEBOUNCE_MS);

    return () => {
      window.clearTimeout(timer);
    };
  }, [data]);

  return {
    data,
    setData,
    syncState,
    roomName: SYNC_ROOM_ID,
  };
}
