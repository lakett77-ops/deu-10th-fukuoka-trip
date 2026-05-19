import type { PlaceDetail } from "../types";

interface NominatimResult {
  place_id: number;
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  display_name: string;
  category?: string;
  type?: string;
  class?: string;
  name?: string;
  address?: Record<string, string>;
  extratags?: Record<string, string>;
  namedetails?: Record<string, string>;
  licence?: string;
}

const NOMINATIM_SEARCH_URL = "https://nominatim.openstreetmap.org/search";

const SEARCH_ALIASES: Record<string, string[]> = {
  신신라멘: ["Shin Shin", "Hakata Ramen Shin Shin"],
  이치란: ["Ichiran", "Ichiran Ramen"],
  멘타이쥬: ["Mentaiju", "Mentai Jyu"],
  나카스포장마차: ["Nakasu Yatai", "Nakasu Food Stalls"],
  텐진이자카야: ["Tenjin Izakaya"],
  다자이후: ["Dazaifu", "Dazaifu Tenmangu"],
  모모치해변: ["Momochi Seaside Park", "Momochihama"],
  캐널시티: ["Canal City Hakata", "Canal City"],
  돈키호테: ["Don Quijote", "Don Quixote"],
  오호리공원: ["Ohori Park", "Ohorikoen"],
};

const normalizeQueryKey = (value: string) => value.replace(/\s+/g, "").trim();

const buildSearchQueries = (query: string) => {
  const trimmed = query.trim();
  const queries = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim();
    if (normalized) queries.add(normalized);
  };

  add(trimmed);

  const aliasKey = normalizeQueryKey(trimmed);
  const aliases = SEARCH_ALIASES[aliasKey] ?? [];

  for (const alias of aliases) {
    add(alias);
    add(`${alias} Fukuoka`);
    add(`${alias} Fukuoka Japan`);
  }

  if (!/fukuoka/i.test(trimmed)) {
    add(`${trimmed} Fukuoka`);
    add(`${trimmed} Fukuoka Japan`);
  }

  return Array.from(queries);
};

const formatAddress = (address?: Record<string, string>) => {
  if (!address) return "";

  const parts = [
    address.amenity,
    address.shop,
    address.office,
    address.building,
    address.house_number,
    address.road,
    address.neighbourhood,
    address.quarter,
    address.suburb,
    address.city,
    address.town,
    address.village,
    address.state,
    address.country,
  ].filter(Boolean);

  return parts.join(", ");
};

const normalizeResult = (result: NominatimResult, query: string): PlaceDetail => {
  const tags = result.extratags ?? {};
  const displayName = result.display_name?.trim() || formatAddress(result.address) || query;
  const rawAddress = result.address ?? {};
  const name = result.name?.trim() || result.namedetails?.name?.trim() || displayName.split(",")[0]?.trim() || query;
  const countryCode = rawAddress.country_code?.trim().toLowerCase() || "";

  return {
    query,
    name,
    displayName,
    address: displayName,
    category: result.category ?? result.class ?? "place",
    type: result.type ?? "",
    countryCode,
    latitude: Number(result.lat),
    longitude: Number(result.lon),
    placeId: result.place_id,
    osmType: result.osm_type,
    osmId: result.osm_id,
    phone: tags.phone ?? tags["contact:phone"] ?? "",
    website: tags.website ?? tags["contact:website"] ?? tags.url ?? "",
    openingHours: tags.opening_hours ?? "",
    mapUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
    osmUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
    license: result.licence ?? "Data © OpenStreetMap contributors, ODbL 1.0",
    tags,
  };
};

const fetchSearchResults = async (query: string) => {
  const params = new URLSearchParams({
    q: query,
    format: "jsonv2",
    addressdetails: "1",
    extratags: "1",
    namedetails: "1",
    limit: "8",
    "accept-language": "ko,en",
  });

  const response = await fetch(`${NOMINATIM_SEARCH_URL}?${params.toString()}`, {
    headers: {
      Accept: "application/json",
    },
  });

  const text = await response.text();
  if (!response.ok) {
    if (text.includes("Access denied")) {
      throw new Error("공개 장소 검색 API가 잠시 요청을 막았어요. 잠시 뒤 다시 시도해 주세요.");
    }

    throw new Error(`장소 검색에 실패했어요. (${response.status})`);
  }

  try {
    return JSON.parse(text) as NominatimResult[];
  } catch {
    throw new Error("장소 검색 응답을 읽지 못했어요.");
  }
};

export async function searchPlaceDetails(query: string): Promise<PlaceDetail[]> {
  const queries = buildSearchQueries(query);
  let fallback: PlaceDetail[] = [];

  for (const item of queries) {
    const results = await fetchSearchResults(item);
    const normalized = results.map((result) => normalizeResult(result, query));
    if (!fallback.length && normalized.length) {
      fallback = normalized;
    }

    const preferred = normalized.filter((result) => result.countryCode === "jp");
    if (preferred.length) {
      return preferred;
    }
  }

  return fallback;
}
