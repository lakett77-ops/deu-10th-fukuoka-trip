import { searchGooglePlaceDetails } from "./googlePlaces";
import type { PlaceDetail } from "../types";

interface NominatimResult {
  place_id: number;
  osm_type: "node" | "way" | "relation";
  osm_id: number;
  lat: string;
  lon: string;
  boundingbox?: string[];
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
const FUKUOKA_VIEWBOX = {
  west: 130.05,
  south: 33.3,
  east: 130.75,
  north: 33.9,
};

export type PlaceSearchMode = "all" | "food";

export const PLACE_SEARCH_PRESETS = [
  { label: "신신라멘", query: "신신라멘" },
  { label: "이치란", query: "이치란" },
  { label: "멘타이쥬", query: "멘타이쥬" },
  { label: "나카스 포장마차", query: "나카스 포장마차" },
  { label: "텐진 이자카야", query: "텐진 이자카야" },
  { label: "다자이후", query: "다자이후" },
  { label: "모모치해변", query: "모모치해변" },
  { label: "캐널시티", query: "캐널시티" },
  { label: "돈키호테", query: "돈키호테" },
  { label: "오호리공원", query: "오호리공원" },
];

const SEARCH_ALIASES: Record<string, string[]> = {
  신신: ["신신라멘", "Shin Shin", "Hakata Ramen Shin Shin", "博多らーめんShinShin"],
  신신라멘: ["신신", "Shin Shin", "Hakata Ramen Shin Shin", "博多らーめんShinShin"],
  신신라멘하카타: ["신신라멘", "신신", "Shin Shin", "Hakata Ramen Shin Shin", "博多らーめんShinShin"],
  이치란: ["이치란 라멘", "Ichiran", "Ichiran Ramen", "一蘭"],
  이치란하카타: ["이치란", "이치란 라멘", "Ichiran", "Ichiran Ramen", "一蘭"],
  멘타이쥬: ["명란덮밥", "Mentaiju", "Mentai Jyu"],
  나카스: ["나카스 포장마차", "Nakasu Yatai", "Nakasu Food Stalls"],
  나카스포장마차: ["나카스", "Nakasu Yatai", "Nakasu Food Stalls"],
  텐진: ["텐진 이자카야", "Tenjin Izakaya"],
  텐진이자카야: ["텐진", "Tenjin Izakaya"],
  다자이후: ["Dazaifu", "Dazaifu Tenmangu", "太宰府"],
  다자이후텐만구: ["다자이후", "Dazaifu", "Dazaifu Tenmangu", "太宰府"],
  모모치: ["모모치해변", "Momochi Seaside Park", "Momochihama"],
  모모치해변: ["모모치", "Momochi Seaside Park", "Momochihama"],
  캐널: ["캐널시티", "Canal City Hakata", "Canal City"],
  캐널시티: ["캐널", "Canal City Hakata", "Canal City"],
  캐널시티하카타: ["캐널시티", "캐널", "Canal City Hakata", "Canal City"],
  돈키호테: ["Don Quijote", "Don Quixote", "ドン・キホーテ"],
  오호리: ["오호리공원", "Ohori Park", "Ohorikoen", "大濠公園"],
  오호리공원: ["오호리", "Ohori Park", "Ohorikoen", "大濠公園"],
  오호리공원후쿠오카: ["오호리공원", "오호리", "Ohori Park", "Ohorikoen", "大濠公園"],
  모모치해변후쿠오카: ["모모치해변", "모모치", "Momochi Seaside Park", "Momochihama"],
};

const normalizeQueryKey = (value: string) => value.toLowerCase().replace(/[\s\-_.,"'()·/]+/g, "").trim();

const stripGenericSuffixes = (value: string) =>
  value
    .trim()
    .replace(/\s*(가게|맛집|식당|술집|카페|공원|해변|호텔|숙소|본점|지점|라멘|라면|이자카야|쇼핑몰|백화점|시장|포장마차)$/u, "")
    .trim();

const FOOD_PLACE_TYPES = new Set([
  "restaurant",
  "cafe",
  "fast_food",
  "bar",
  "pub",
  "food_court",
  "ice_cream",
  "biergarten",
  "restaurant;ramen",
]);

const isFoodPlace = (result: Pick<PlaceDetail, "category" | "type">) => {
  const category = result.category.toLowerCase();
  const type = result.type.toLowerCase();

  if (category === "amenity" && FOOD_PLACE_TYPES.has(type)) {
    return true;
  }

  return category === "tourism" && type === "restaurant";
};

const buildSearchQueries = (query: string, mode: PlaceSearchMode) => {
  const trimmed = query.trim();
  const queries = new Set<string>();
  const add = (value: string) => {
    const normalized = value.trim();
    if (normalized) queries.add(normalized);
  };

  add(trimmed);
  add(stripGenericSuffixes(trimmed));

  const aliasKey = normalizeQueryKey(trimmed);
  const strippedAliasKey = normalizeQueryKey(stripGenericSuffixes(trimmed));
  const aliases = [...(SEARCH_ALIASES[aliasKey] ?? []), ...(SEARCH_ALIASES[strippedAliasKey] ?? [])];

  for (const alias of aliases) {
    add(alias);
    add(`${alias} Fukuoka`);
    add(`${alias} Fukuoka Japan`);
  }

  if (/(라멘|ramen)/i.test(trimmed)) {
    add("Shin Shin Fukuoka");
    add("Ichiran Fukuoka");
    add("Hakata ramen Fukuoka");
  }

  if (/(이자카야|술집|izakaya)/i.test(trimmed)) {
    add("Tenjin Izakaya");
    add("Nakasu Yatai");
    add("Fukuoka izakaya");
  }

  if (/(카페|cafe)/i.test(trimmed)) {
    add("Fukuoka cafe");
    add("Tenjin cafe");
  }

  if (/(공원|park)/i.test(trimmed)) {
    add("Ohori Park");
    add("Dazaifu Tenmangu");
  }

  if (/(해변|beach)/i.test(trimmed)) {
    add("Momochi Seaside Park");
  }

  if (/(쇼핑|면세|돈키|donki)/i.test(trimmed)) {
    add("Don Quijote Fukuoka");
    add("Canal City Hakata");
  }

  if (/(다자이후|temmangu|dazaifu)/i.test(trimmed)) {
    add("Dazaifu Tenmangu");
  }

  if (!/fukuoka/i.test(trimmed)) {
    add(`${trimmed} Fukuoka`);
    add(`${trimmed} Fukuoka Japan`);
  }

  if (mode === "food") {
    add(`${trimmed} [restaurant]`);
    add(`${trimmed} [cafe]`);
    add(`${trimmed} [bar]`);
    add(`${trimmed} [pub]`);
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

const parseBoundingBox = (value: string[] | undefined, latitude: number, longitude: number): [number, number, number, number] => {
  const south = Number(value?.[0] ?? latitude);
  const north = Number(value?.[1] ?? latitude);
  const west = Number(value?.[2] ?? longitude);
  const east = Number(value?.[3] ?? longitude);

  if ([south, north, west, east].some((item) => Number.isNaN(item))) {
    return [latitude, latitude, longitude, longitude];
  }

  return [south, north, west, east];
};

const normalizeResult = (result: NominatimResult, query: string): PlaceDetail => {
  const tags = result.extratags ?? {};
  const displayName = result.display_name?.trim() || formatAddress(result.address) || query;
  const rawAddress = result.address ?? {};
  const latitude = Number(result.lat);
  const longitude = Number(result.lon);
  const boundingBox = parseBoundingBox(result.boundingbox, latitude, longitude);
  const name = result.name?.trim() || result.namedetails?.name?.trim() || displayName.split(",")[0]?.trim() || query;
  const countryCode = rawAddress.country_code?.trim().toLowerCase() || "";
  const [south, north, west, east] = boundingBox;
  const embedMapUrl = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${latitude}%2C${longitude}`;

  return {
    source: "osm",
    query,
    name,
    displayName,
    address: displayName,
    category: result.category ?? result.class ?? "place",
    type: result.type ?? "",
    countryCode,
    latitude,
    longitude,
    placeId: result.place_id,
    osmType: result.osm_type,
    osmId: result.osm_id,
    phone: tags.phone ?? tags["contact:phone"] ?? "",
    website: tags.website ?? tags["contact:website"] ?? tags.url ?? "",
    openingHours: tags.opening_hours ?? "",
    boundingBox,
    mapUrl: `https://www.openstreetmap.org/${result.osm_type}/${result.osm_id}`,
    embedMapUrl,
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
    countrycodes: "jp",
    viewbox: `${FUKUOKA_VIEWBOX.west},${FUKUOKA_VIEWBOX.south},${FUKUOKA_VIEWBOX.east},${FUKUOKA_VIEWBOX.north}`,
    bounded: "1",
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

export async function searchPlaceDetails(
  query: string,
  options: { mode?: PlaceSearchMode; googleMapsApiKey?: string } = {},
): Promise<PlaceDetail[]> {
  const mode = options.mode ?? "all";
  const googleResults = await searchGooglePlaceDetails(query, { mode, apiKey: options.googleMapsApiKey });
  if (googleResults?.length) {
    return googleResults;
  }

  const queries = buildSearchQueries(query, mode);
  let fallback: PlaceDetail[] = [];

  for (const item of queries) {
    const results = await fetchSearchResults(item);
    const normalized = results.map((result) => normalizeResult(result, query));
    const filtered = mode === "food" ? normalized.filter((result) => isFoodPlace(result)) : normalized;

    if (!fallback.length && filtered.length) {
      fallback = filtered;
    }

    const preferred = filtered.filter((result) => result.countryCode === "jp");
    if (preferred.length) {
      return preferred;
    }
  }

  return fallback;
}
