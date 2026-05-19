import type { PlaceDetail } from "../types";

export type PlaceSearchMode = "all" | "food";

interface GoogleLatLngLike {
  lat: () => number;
  lng: () => number;
}

interface GoogleLatLngBoundsLike {
  toJSON?: () => { north: number; south: number; east: number; west: number };
}

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GooglePlaceResult {
  place_id: string;
  name?: string;
  formatted_address?: string;
  address_components?: GoogleAddressComponent[];
  geometry?: {
    location?: GoogleLatLngLike;
    viewport?: GoogleLatLngBoundsLike;
  };
  types?: string[];
  business_status?: string;
  formatted_phone_number?: string;
  international_phone_number?: string;
  website?: string;
  opening_hours?: {
    open_now?: boolean;
    weekday_text?: string[];
  };
  url?: string;
  rating?: number;
  user_ratings_total?: number;
  vicinity?: string;
}

type TextSearchRequest = {
  query: string;
  type?: string;
  location?: GoogleLatLngLike;
  radius?: number;
  openNow?: boolean;
};

type GoogleMapsWindow = Window & {
  google?: {
    maps?: {
      LatLng: new (lat: number, lng: number) => GoogleLatLngLike;
      places?: {
        PlacesService: new (attrContainer: HTMLDivElement | HTMLElement) => {
          textSearch: (
            request: TextSearchRequest,
            callback: (results: GooglePlaceResult[] | null, status: string) => void,
          ) => void;
        };
      };
    };
  };
  __codexGoogleMapsInit__?: () => void;
};

const GOOGLE_MAPS_SCRIPT_ID = "google-maps-places-loader";
const GOOGLE_MAPS_CENTER = { lat: 33.5902, lng: 130.4017 };
const GOOGLE_MAPS_RADIUS = 30000;
let googleMapsLoaderPromise: Promise<GoogleMapsWindow["google"] | null> | null = null;

const googleMapsWindow = () => window as GoogleMapsWindow;

const getApiKey = (overrideKey?: string) => overrideKey?.trim() || import.meta.env.VITE_GOOGLE_MAPS_API_KEY?.trim() || "";

const normalizeQueryKey = (value: string) => value.toLowerCase().replace(/[\s\-_.,"'()·/]+/g, "").trim();

const stripGenericSuffixes = (value: string) =>
  value
    .trim()
    .replace(/\s*(가게|맛집|식당|술집|카페|공원|해변|호텔|숙소|본점|지점|라멘|라면|이자카야|쇼핑몰|백화점|시장|포장마차)$/u, "")
    .trim();

const buildGoogleQueries = (query: string) => {
  const trimmed = query.trim();
  const queries = new Set<string>();

  const add = (value: string) => {
    const normalized = value.trim();
    if (normalized) queries.add(normalized);
  };

  add(trimmed);
  add(stripGenericSuffixes(trimmed));

  if (!/fukuoka/i.test(trimmed)) {
    add(`${trimmed} Fukuoka`);
    add(`${stripGenericSuffixes(trimmed)} Fukuoka`);
  }

  const aliasKey = normalizeQueryKey(trimmed);
  const strippedAliasKey = normalizeQueryKey(stripGenericSuffixes(trimmed));

  if (/(신신|shinshin|shin shin)/i.test(aliasKey) || /(신신|shinshin|shin shin)/i.test(strippedAliasKey)) {
    add("Shin Shin Fukuoka");
    add("Hakata Ramen Shin Shin");
  }

  if (/(이치란|ichiran)/i.test(aliasKey) || /(이치란|ichiran)/i.test(strippedAliasKey)) {
    add("Ichiran Fukuoka");
    add("Ichiran Ramen");
  }

  if (/(멘타이|mentaiju|mentai)/i.test(aliasKey) || /(멘타이|mentaiju|mentai)/i.test(strippedAliasKey)) {
    add("Mentaiju Fukuoka");
    add("Mentai Jyu");
  }

  if (/(나카스|nakasu)/i.test(aliasKey) || /(나카스|nakasu)/i.test(strippedAliasKey)) {
    add("Nakasu Yatai");
  }

  if (/(텐진|tenjin)/i.test(aliasKey) || /(텐진|tenjin)/i.test(strippedAliasKey)) {
    add("Tenjin Izakaya");
    add("Tenjin cafe");
  }

  if (/(다자이후|dazaifu)/i.test(aliasKey) || /(다자이후|dazaifu)/i.test(strippedAliasKey)) {
    add("Dazaifu Tenmangu");
  }

  if (/(모모치|momochi)/i.test(aliasKey) || /(모모치|momochi)/i.test(strippedAliasKey)) {
    add("Momochi Seaside Park");
  }

  if (/(오호리|ohori)/i.test(aliasKey) || /(오호리|ohori)/i.test(strippedAliasKey)) {
    add("Ohori Park");
  }

  if (/(캐널|canal)/i.test(aliasKey) || /(캐널|canal)/i.test(strippedAliasKey)) {
    add("Canal City Hakata");
  }

  if (/(돈키|donki|don quijote|don quixote)/i.test(aliasKey) || /(돈키|donki|don quijote|don quixote)/i.test(strippedAliasKey)) {
    add("Don Quijote Fukuoka");
  }

  return Array.from(queries);
};

const inferTypeHints = (query: string, mode: PlaceSearchMode) => {
  if (mode !== "food") return [];

  if (/(카페|cafe)/i.test(query)) {
    return ["cafe", "restaurant"];
  }

  if (/(이자카야|술집|bar|pub|포장마차)/i.test(query)) {
    return ["bar", "restaurant"];
  }

  return ["restaurant"];
};

const buildSearchRequests = (query: string, mode: PlaceSearchMode): TextSearchRequest[] => {
  const requests: TextSearchRequest[] = [];
  const seen = new Set<string>();
  const types = inferTypeHints(query, mode);
  const google = googleMapsWindow().google;
  const location = google?.maps ? new google.maps.LatLng(GOOGLE_MAPS_CENTER.lat, GOOGLE_MAPS_CENTER.lng) : undefined;

  for (const candidateQuery of buildGoogleQueries(query)) {
    const variants = mode === "food" ? [...types, undefined] : [undefined];

    for (const type of variants) {
      const key = `${candidateQuery}::${type ?? ""}`;
      if (seen.has(key)) continue;
      seen.add(key);

      requests.push({
        query: candidateQuery,
        type,
        location,
        radius: GOOGLE_MAPS_RADIUS,
        openNow: false,
      });
    }
  }

  return requests;
};

const parseCountryCode = (result: GooglePlaceResult) => {
  const country = result.address_components?.find((component) => component.types.includes("country"));
  const code = country?.short_name?.trim().toLowerCase() ?? "";
  if (code) return code;

  const text = result.formatted_address ?? result.vicinity ?? "";
  return /japan|日本/i.test(text) ? "jp" : "";
};

const toLatLngBounds = (viewport?: GoogleLatLngBoundsLike, latitude = 0, longitude = 0): [number, number, number, number] => {
  const box = viewport?.toJSON?.();
  if (!box) {
    return [latitude, latitude, longitude, longitude];
  }

  return [box.south, box.north, box.west, box.east];
};

const toGoogleEmbedUrl = (latitude: number, longitude: number) =>
  `https://www.openstreetmap.org/export/embed.html?bbox=${longitude - 0.01}%2C${latitude - 0.01}%2C${longitude + 0.01}%2C${
    latitude + 0.01
  }&layer=mapnik&marker=${latitude}%2C${longitude}`;

const normalizeGoogleResult = (result: GooglePlaceResult, query: string): PlaceDetail => {
  const latitude = result.geometry?.location?.lat?.() ?? 0;
  const longitude = result.geometry?.location?.lng?.() ?? 0;
  const formattedAddress = result.formatted_address?.trim() || result.vicinity?.trim() || query;
  const placeTypes = result.types ?? [];
  const category = placeTypes[0] ?? "place";
  const type = placeTypes[1] ?? "";
  const tags: Record<string, string> = {};

  if (result.business_status) tags.businessStatus = result.business_status;
  if (result.rating !== undefined) tags.rating = String(result.rating);
  if (result.user_ratings_total !== undefined) tags.userRatingsTotal = String(result.user_ratings_total);
  if (placeTypes.length) tags.types = placeTypes.join(", ");
  if (result.place_id) tags.googlePlaceId = result.place_id;

  return {
    source: "google",
    query,
    name: result.name?.trim() || formattedAddress.split(",")[0]?.trim() || query,
    displayName: result.name?.trim() || formattedAddress || query,
    address: formattedAddress,
    category,
    type,
    countryCode: parseCountryCode(result),
    latitude,
    longitude,
    placeId: result.place_id,
    phone: result.formatted_phone_number ?? result.international_phone_number ?? "",
    website: result.website ?? "",
    openingHours:
      result.opening_hours?.weekday_text?.join(" / ") ??
      (typeof result.opening_hours?.open_now === "boolean"
        ? result.opening_hours.open_now
          ? "영업 중"
          : "영업 종료"
        : ""),
    boundingBox: toLatLngBounds(result.geometry?.viewport, latitude, longitude),
    mapUrl: result.url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.name ?? query)}`,
    embedMapUrl: toGoogleEmbedUrl(latitude, longitude),
    osmUrl: result.url ?? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(result.name ?? query)}`,
    license: "Google Maps Platform",
    tags,
  };
};

const loadGoogleMapsPlacesApi = async (apiKey: string) => {
  if (typeof window === "undefined" || !apiKey) return null;

  const currentWindow = googleMapsWindow();
  if (currentWindow.google?.maps?.places?.PlacesService) {
    return currentWindow.google;
  }

  if (googleMapsLoaderPromise) {
    return googleMapsLoaderPromise;
  }

  googleMapsLoaderPromise = new Promise<GoogleMapsWindow["google"] | null>((resolve) => {
    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    const timeoutId = window.setTimeout(() => {
      cleanup();
      resolve(null);
    }, 8000);

    const cleanup = () => {
      window.clearTimeout(timeoutId);
      delete currentWindow.__codexGoogleMapsInit__;
      script.onerror = null;
    };

    currentWindow.__codexGoogleMapsInit__ = () => {
      cleanup();
      resolve(currentWindow.google ?? null);
    };

    script.onerror = () => {
      cleanup();
      resolve(null);
    };

    const params = new URLSearchParams({
      key: apiKey,
      loading: "async",
      libraries: "places",
      v: "weekly",
      language: "ko",
      region: "JP",
      callback: "__codexGoogleMapsInit__",
    });

    script.src = `https://maps.googleapis.com/maps/api/js?${params.toString()}`;
    document.head.appendChild(script);
  });

  try {
    return await googleMapsLoaderPromise;
  } finally {
    googleMapsLoaderPromise = null;
  }
};

const textSearch = async (
  service: {
    textSearch: (request: TextSearchRequest, callback: (results: GooglePlaceResult[] | null, status: string) => void) => void;
  },
  request: TextSearchRequest,
) =>
  await new Promise<GooglePlaceResult[]>((resolve, reject) => {
    service.textSearch(request, (results, status) => {
      if (status === "OK") {
        resolve(results ?? []);
        return;
      }

      if (status === "ZERO_RESULTS") {
        resolve([]);
        return;
      }

      reject(new Error(`Google 장소 검색에 실패했어요. (${status})`));
    });
  });

export async function searchGooglePlaceDetails(
  query: string,
  options: { mode?: PlaceSearchMode; apiKey?: string } = {},
): Promise<PlaceDetail[] | null> {
  const apiKey = getApiKey(options.apiKey);
  if (!apiKey) {
    return null;
  }

  const google = await loadGoogleMapsPlacesApi(apiKey);
  if (!google?.maps?.places?.PlacesService) {
    return null;
  }

  const PlacesService = google.maps.places.PlacesService;
  const service = new PlacesService(document.createElement("div"));
  const requests = buildSearchRequests(query, options.mode ?? "all");
  let fallback: PlaceDetail[] = [];

  for (const request of requests) {
    try {
      const results = await textSearch(service, request);
      const normalized = results.map((result) => normalizeGoogleResult(result, query));
      const filtered =
        options.mode === "food"
          ? normalized.filter((result) => {
              const type = `${result.category} ${result.type} ${result.tags.types ?? ""}`.toLowerCase();
              return /(restaurant|cafe|bar|pub|food|meal|bistro|ramen|izakaya)/i.test(type) || result.category === "restaurant";
            })
          : normalized;

      if (!fallback.length && filtered.length) {
        fallback = filtered;
      }

      const preferred = filtered.filter((result) => result.countryCode === "jp");
      if (preferred.length) {
        return preferred;
      }
    } catch {
      // 다음 요청으로 넘깁니다.
    }
  }

  return fallback.length ? fallback : null;
}
