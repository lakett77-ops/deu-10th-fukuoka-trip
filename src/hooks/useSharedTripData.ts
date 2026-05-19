import { useEffect, useRef, useState } from "react";
import * as Y from "yjs";
import { WebsocketProvider } from "y-websocket";
import type { TravelAppData } from "../types";
import { loadTripData } from "../utils/storage";
import {
  buildTripSnapshot,
  COLLABORATION_ROOM,
  readTripDataFromSnapshot,
  snapshotHasData,
  snapshotToKey,
  type TripSectionSnapshot,
} from "../utils/collaboration";

const SEED_DELAY_MS = 1200;

type SyncState = "connecting" | "ready";

export function useSharedTripData() {
  const [data, setData] = useState<TravelAppData>(() => loadTripData());
  const [syncState, setSyncState] = useState<SyncState>("connecting");
  const docRef = useRef<Y.Doc | null>(null);
  const providerRef = useRef<WebsocketProvider | null>(null);
  const dataRef = useRef(data);
  const lastSyncedSnapshotRef = useRef("");
  const remoteSeenRef = useRef(false);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const doc = new Y.Doc();
    const wsProtocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${wsProtocol}//${window.location.host}/yjs`;
    const provider = new WebsocketProvider(wsUrl, COLLABORATION_ROOM, doc);
    const sections = doc.getMap<string>("trip-sections");

    docRef.current = doc;
    providerRef.current = provider;
    setSyncState("connecting");

    const syncFromDoc = () => {
      const snapshot: Partial<TripSectionSnapshot> = {};
      sections.forEach((value, key) => {
        if (typeof value === "string") {
          snapshot[key as keyof TripSectionSnapshot] = value;
        }
      });

      if (!snapshotHasData(snapshot)) {
        return;
      }

      remoteSeenRef.current = true;
      const snapshotKey = snapshotToKey(snapshot);
      if (snapshotKey === lastSyncedSnapshotRef.current) {
        return;
      }

      lastSyncedSnapshotRef.current = snapshotKey;
      setData((current) => readTripDataFromSnapshot(snapshot, current));
    };

    sections.observe(syncFromDoc);
    provider.on("sync", (isSynced) => {
      if (isSynced) {
        setSyncState("ready");
      }
    });

    // If the room is empty, seed it from the current browser state so the first
    // person can become the source of truth and others will join that state.
    const seedTimer = window.setTimeout(() => {
      if (remoteSeenRef.current) return;

      const snapshot = buildTripSnapshot(dataRef.current);
      const snapshotKey = snapshotToKey(snapshot);
      if (snapshotKey === lastSyncedSnapshotRef.current) return;

      doc.transact(() => {
        (Object.keys(snapshot) as Array<keyof typeof snapshot>).forEach((key) => {
          sections.set(key, snapshot[key]);
        });
      });

      lastSyncedSnapshotRef.current = snapshotKey;
      setSyncState("ready");
    }, SEED_DELAY_MS);

    return () => {
      window.clearTimeout(seedTimer);
      sections.unobserve(syncFromDoc);
      provider.destroy();
      doc.destroy();
      docRef.current = null;
      providerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const doc = docRef.current;
    if (!doc) return;

    const snapshot = buildTripSnapshot(data);
    const snapshotKey = snapshotToKey(snapshot);
    if (snapshotKey === lastSyncedSnapshotRef.current) {
      return;
    }

    const sections = doc.getMap<string>("trip-sections");
    doc.transact(() => {
      (Object.keys(snapshot) as Array<keyof typeof snapshot>).forEach((key) => {
        sections.set(key, snapshot[key]);
      });
    });
    lastSyncedSnapshotRef.current = snapshotKey;
  }, [data]);

  return {
    data,
    setData,
    syncState,
    roomName: COLLABORATION_ROOM,
  };
}
