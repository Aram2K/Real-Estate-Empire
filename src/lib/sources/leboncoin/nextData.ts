import type { HarvestedAd } from "./harvest";

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord {
  return value !== null && typeof value === "object" ? (value as UnknownRecord) : {};
}

function attribute(ad: UnknownRecord, key: string): UnknownRecord {
  const attrs = Array.isArray(ad.attributes) ? ad.attributes : [];
  return record(attrs.find((item) => record(item).key === key));
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "string" ? Number(value.replace(",", ".")) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Convert a Leboncoin search page's embedded Next.js payload to import rows. */
export function extractLeboncoinNextData(payload: unknown): HarvestedAd[] {
  const root = record(payload);
  const props = record(root.props);
  const pageProps = record(props.pageProps);
  const searchData = record(pageProps.searchData);
  const ads = Array.isArray(searchData.ads) ? searchData.ads : [];

  return ads.flatMap((raw): HarvestedAd[] => {
    const ad = record(raw);
    const location = record(ad.location);
    const owner = record(ad.owner);
    const id = ad.list_id ?? ad.id;
    const price = Array.isArray(ad.price) ? ad.price[0] : ad.price;
    const square = attribute(ad, "square").value;
    const rooms = attribute(ad, "rooms").value;
    const realEstateType = attribute(ad, "real_estate_type").value;
    const images = record(ad.images);
    const imageUrls = [images.urls_large, images.urls, images.urls_thumb]
      .find(Array.isArray) as unknown[] | undefined;
    if (id == null) return [];

    return [{
      id: String(id),
      url: typeof ad.url === "string" ? ad.url : undefined,
      ownerType: typeof owner.type === "string" ? owner.type : null,
      ownerName: typeof owner.name === "string" ? owner.name : null,
      // Leboncoin exposes whole euros; Listing.price is stored in cents.
      priceCents: numeric(price) == null ? null : Math.round(numeric(price)! * 100),
      city: typeof location.city === "string" ? location.city : null,
      zipcode: typeof location.zipcode === "string" ? location.zipcode : null,
      lat: numeric(location.lat),
      lng: numeric(location.lng),
      originType: typeof location.source === "string" ? location.source : null,
      realEstateType: realEstateType == null ? null : String(realEstateType),
      square: numeric(square),
      rooms: numeric(rooms),
      energy: attribute(ad, "energy_rate").value == null
        ? null
        : String(attribute(ad, "energy_rate").value),
      status: typeof ad.status === "string" ? ad.status : "active",
      title: typeof ad.subject === "string" ? ad.subject : null,
      description: typeof ad.body === "string" ? ad.body : null,
      publishedAt: typeof ad.first_publication_date === "string"
        ? ad.first_publication_date
        : typeof ad.index_date === "string" ? ad.index_date : null,
      // `undefined` means the payload did not expose photo metadata; zero is
      // explicit evidence that this search result has no listing photos.
      photoCount: imageUrls?.length,
    }];
  });
}
