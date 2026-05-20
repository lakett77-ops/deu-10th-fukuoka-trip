export const SYNC_ROOM_ID = "deu-10th-fukuoka-trip";
export const SYNC_TABLE = "trip_state";

export interface CloudConfig {
  url: string;
  anonKey: string;
}

export const getCloudConfig = (): CloudConfig | null => {
  const url = import.meta.env.VITE_SUPABASE_URL?.trim();
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!url || !anonKey) {
    return null;
  }

  return { url, anonKey };
};

export const buildHeaders = (anonKey: string) => ({
  apikey: anonKey,
  Authorization: `Bearer ${anonKey}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  "Accept-Profile": "public",
  "Content-Profile": "public",
});
