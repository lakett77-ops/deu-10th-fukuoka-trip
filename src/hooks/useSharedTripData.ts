import { useEffect, useRef, useState } from "react";
import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { TravelAppData } from "../types";
import { loadTripData } from "../utils/storage";

const SYNC_ROOM_ID = "deu-10th-fukuoka-trip";
const SYNC_TABLE = "trip_state";
const SYNC_DEBOUNCE_MS = 500;

type SyncState = "connecting" | "ready";

type TripRow = {
  id: string;
  payload: TravelAppData;
  updated_at?: string;
};

const getSupabaseConfig = () => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
};

const serialize = (value: TravelAppData) => JSON.stringify(value);

export function useSharedTripData() {
  const [data, setData] = useState<TravelAppData>(() => loadTripData());
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const supabaseRef = useRef<SupabaseClient | null>(null);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isReadyRef = useRef(false);
  const dataRef = useRef(data);
  const lastPublishedRef = useRef("");

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const config = getSupabaseConfig();
    if (!config) {
      setSyncState("ready");
      return undefined;
    }

    const supabase = createClient(config.url, config.anonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });

    supabaseRef.current = supabase;
    setSyncState("connecting");

    let cancelled = false;

    const syncInitialState = async () => {
      try {
        const { data: row, error } = await supabase
          .from(SYNC_TABLE)
          .select("id,payload,updated_at")
          .eq("id", SYNC_ROOM_ID)
          .maybeSingle<TripRow>();

        if (cancelled) return;

        if (error && error.code !== "PGRST116") {
          console.warn("Supabase sync fetch failed:", error);
        }

        if (row?.payload) {
          const remoteSerialized = serialize(row.payload);
          lastPublishedRef.current = remoteSerialized;
          setData(row.payload);
        } else {
          const seed = dataRef.current;
          const seedSerialized = serialize(seed);
          lastPublishedRef.current = seedSerialized;

          const { error: seedError } = await supabase.from(SYNC_TABLE).upsert(
            {
              id: SYNC_ROOM_ID,
              payload: seed,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );

          if (seedError) {
            console.warn("Supabase sync seed failed:", seedError);
          }
        }

        if (cancelled) return;

        const channel = supabase
          .channel(`trip-state:${SYNC_ROOM_ID}`)
          .on(
            "postgres_changes",
            {
              event: "*",
              schema: "public",
              table: SYNC_TABLE,
              filter: `id=eq.${SYNC_ROOM_ID}`,
            },
            (payload) => {
              const nextRow = payload.new as TripRow | null;
              if (!nextRow?.payload) return;

              const nextSerialized = serialize(nextRow.payload);
              if (nextSerialized === lastPublishedRef.current) {
                return;
              }

              lastPublishedRef.current = nextSerialized;
              setData(nextRow.payload);
            },
          )
          .subscribe((status) => {
            if (status === "SUBSCRIBED") {
              isReadyRef.current = true;
              setSyncState("ready");
            }
          });

        channelRef.current = channel;
        isReadyRef.current = true;
        setSyncState("ready");
      } catch (error) {
        console.warn("Supabase sync initialization failed:", error);
        isReadyRef.current = true;
        setSyncState("ready");
      }
    };

    void syncInitialState();

    return () => {
      cancelled = true;
      isReadyRef.current = false;
      if (channelRef.current) {
        void supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
      supabaseRef.current = null;
    };
  }, []);

  useEffect(() => {
    const supabase = supabaseRef.current;
    if (!supabase || !isReadyRef.current) return undefined;

    const serialized = serialize(data);
    if (serialized === lastPublishedRef.current) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      void (async () => {
        try {
          const { error } = await supabase.from(SYNC_TABLE).upsert(
            {
              id: SYNC_ROOM_ID,
              payload: data,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "id" },
          );

          if (error) {
            console.warn("Supabase sync publish failed:", error);
            return;
          }

          lastPublishedRef.current = serialized;
        } catch (publishError) {
          console.warn("Supabase sync publish threw:", publishError);
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
