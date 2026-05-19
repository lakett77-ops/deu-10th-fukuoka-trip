import type { PlaceDetail } from "../types";
import type { PlaceSearchMode } from "./placeDetails";

type CatalogKind = "food" | "bar" | "cafe" | "activity" | "shopping" | "stay";

interface CatalogPlaceSeed {
  id: string;
  name: string;
  address: string;
  category: string;
  type: string;
  kind: CatalogKind;
  latitude: number;
  longitude: number;
  phone?: string;
  website?: string;
  openingHours?: string;
  aliases: string[];
}

const FUKUOKA_CATALOG: CatalogPlaceSeed[] = [
  {
    id: "shinshin-tenjin",
    name: "博多らーめん ShinShin 天神本店",
    address: "후쿠오카 텐진 주변",
    category: "restaurant",
    type: "ramen",
    kind: "food",
    latitude: 33.5928,
    longitude: 130.3957,
    aliases: ["신신", "신신라멘", "신신 라멘", "shin shin", "hakata ramen shin shin", "博多らーめんshinshin"],
  },
  {
    id: "shinshin-hakata",
    name: "博多らーめん ShinShin 하카타역점",
    address: "후쿠오카 하카타역 주변",
    category: "restaurant",
    type: "ramen",
    kind: "food",
    latitude: 33.5902,
    longitude: 130.4206,
    aliases: ["신신 하카타", "신신라멘 하카타", "shin shin hakata", "hakata ramen shin shin hakata"],
  },
  {
    id: "ichiran-hakata",
    name: "이치란 하카타점",
    address: "후쿠오카 하카타 주변",
    category: "restaurant",
    type: "ramen",
    kind: "food",
    latitude: 33.5914,
    longitude: 130.4149,
    aliases: ["이치란", "이치란 라멘", "ichiran", "ichiran ramen", "一蘭"],
  },
  {
    id: "ichiran-nakasu",
    name: "이치란 본사총본점",
    address: "후쿠오카 나카스 주변",
    category: "restaurant",
    type: "ramen",
    kind: "food",
    latitude: 33.5935,
    longitude: 130.4051,
    aliases: ["이치란 나카스", "이치란 본점", "ichiran nakasu", "ichiran main store"],
  },
  {
    id: "mentaiju",
    name: "元祖博多めんたい重",
    address: "후쿠오카 나카스카와바타 주변",
    category: "restaurant",
    type: "japanese_food",
    kind: "food",
    latitude: 33.5927,
    longitude: 130.4046,
    aliases: ["멘타이쥬", "멘타이 주", "명란덮밥", "mentaiju", "mentai jyu", "元祖博多めんたい重"],
  },
  {
    id: "nakasu-yatai",
    name: "나카스 포장마차 거리",
    address: "후쿠오카 나카스 강변",
    category: "restaurant",
    type: "yatai",
    kind: "food",
    latitude: 33.5917,
    longitude: 130.4076,
    aliases: ["나카스", "나카스 포장마차", "포장마차", "nakasu yatai", "nakasu food stalls"],
  },
  {
    id: "tenjin-izakaya",
    name: "텐진 이자카야 거리",
    address: "후쿠오카 텐진 주변",
    category: "bar",
    type: "izakaya",
    kind: "bar",
    latitude: 33.5895,
    longitude: 130.3984,
    aliases: ["텐진 이자카야", "텐진 술집", "이자카야", "tenjin izakaya", "tenjin bar"],
  },
  {
    id: "dazaifu-tenmangu",
    name: "다자이후 텐만구",
    address: "후쿠오카현 다자이후시",
    category: "tourism",
    type: "shrine",
    kind: "activity",
    latitude: 33.5215,
    longitude: 130.5348,
    aliases: ["다자이후", "다자이후 텐만구", "dazaifu", "dazaifu tenmangu", "太宰府天満宮"],
  },
  {
    id: "momochi-seaside",
    name: "모모치해변",
    address: "후쿠오카 모모치하마 주변",
    category: "tourism",
    type: "beach",
    kind: "activity",
    latitude: 33.5931,
    longitude: 130.3515,
    aliases: ["모모치", "모모치해변", "모모치 해변", "momochi", "momochi seaside park", "momochihama"],
  },
  {
    id: "ohori-park",
    name: "오호리공원",
    address: "후쿠오카 오호리공원 주변",
    category: "leisure",
    type: "park",
    kind: "activity",
    latitude: 33.5862,
    longitude: 130.3764,
    aliases: ["오호리", "오호리공원", "오호리 공원", "ohori park", "ohorikoen", "大濠公園"],
  },
  {
    id: "canal-city",
    name: "캐널시티 하카타",
    address: "후쿠오카 하카타 주변",
    category: "shopping",
    type: "mall",
    kind: "shopping",
    latitude: 33.5898,
    longitude: 130.4111,
    aliases: ["캐널", "캐널시티", "캐널시티 하카타", "canal city", "canal city hakata"],
  },
  {
    id: "don-quijote-nakasu",
    name: "돈키호테 나카스점",
    address: "후쿠오카 나카스 주변",
    category: "shopping",
    type: "discount_store",
    kind: "shopping",
    latitude: 33.5939,
    longitude: 130.4053,
    aliases: ["돈키", "돈키호테", "돈키호테 나카스", "donki", "don quijote", "don quixote"],
  },
];

const normalizeQueryKey = (value: string) =>
  value
    .toLowerCase()
    .replace(/[\s\-_.,"'()·/]+/g, "")
    .trim();

const isFoodModeMatch = (place: CatalogPlaceSeed) => ["food", "bar", "cafe"].includes(place.kind);

const scorePlace = (place: CatalogPlaceSeed, normalizedQuery: string) => {
  const normalizedName = normalizeQueryKey(place.name);
  const normalizedAliases = place.aliases.map(normalizeQueryKey);

  if (normalizedAliases.includes(normalizedQuery) || normalizedName === normalizedQuery) return 100;
  if (normalizedAliases.some((alias) => alias.includes(normalizedQuery) || normalizedQuery.includes(alias))) return 80;
  if (normalizedName.includes(normalizedQuery) || normalizedQuery.includes(normalizedName)) return 70;
  return normalizedAliases.some((alias) => normalizedQuery.includes(alias.slice(0, 3)) && alias.length >= 3) ? 30 : 0;
};

const toEmbedMapUrl = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${
    latitude + 0.01
  }&layer=mapnik&marker=${latitude}%2C${longitude}`;

const toPlaceDetail = (place: CatalogPlaceSeed, query: string): PlaceDetail => {
  const mapQuery = `${place.name} Fukuoka`;
  const mapUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(mapQuery)}`;

  return {
    source: "catalog",
    query,
    name: place.name,
    displayName: place.name,
    address: place.address,
    category: place.category,
    type: place.type,
    countryCode: "jp",
    latitude: place.latitude,
    longitude: place.longitude,
    placeId: `catalog-${place.id}`,
    phone: place.phone ?? "",
    website: place.website ?? "",
    openingHours: place.openingHours ?? "",
    boundingBox: [place.latitude - 0.01, place.latitude + 0.01, place.longitude - 0.01, place.longitude + 0.01],
    mapUrl,
    embedMapUrl: toEmbedMapUrl(place.latitude, place.longitude),
    osmUrl: mapUrl,
    license: "앱 기본 후보",
    tags: {
      source: "앱 기본 후보",
      mapSearch: mapQuery,
    },
  };
};

export function searchFukuokaPlaceCatalog(query: string, mode: PlaceSearchMode): PlaceDetail[] {
  const normalizedQuery = normalizeQueryKey(query);
  if (!normalizedQuery) return [];

  return FUKUOKA_CATALOG.map((place) => ({ place, score: scorePlace(place, normalizedQuery) }))
    .filter(({ place, score }) => score > 0 && (mode !== "food" || isFoodModeMatch(place)))
    .sort((left, right) => right.score - left.score || left.place.name.localeCompare(right.place.name))
    .map(({ place }) => toPlaceDetail(place, query));
}
