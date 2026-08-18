import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';
import { geocodeAddress, geocodeCityZip } from '../common/geocode.util';
import {
  CreateStudioDto,
  StudioRateDto,
  UpdateStudioDto,
} from './dto/upsert-studio.dto';
import {
  normalizePrecision,
  normalizeRateUnit,
  publishStudioLocation,
  startingAtFromRates,
  type StudioLocationPrecision,
  type StudioRateUnit,
} from './studio-public.util';

export interface StudioRate {
  id: string;
  label: string;
  priceCents: number;
  unit: StudioRateUnit;
  notes: string | null;
  sortOrder: number;
}

export interface StudioPublic {
  kind: 'studio';
  id: string;
  ownerUserId: string;
  ownerDisplayName: string | null;
  name: string;
  tagline: string | null;
  about: string | null;
  heroImageUrl: string | null;
  photos: string[];
  amenities: string[];
  city: string | null;
  state: string | null;
  zipCode: string | null;
  country: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  lat: number | null;
  lng: number | null;
  vicinityRadiusKm: number | null;
  locationPrecision: StudioLocationPrecision;
  startingAtCents: number | null;
  startingAtUnit: StudioRateUnit | null;
  bookingLink: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  isPublished: boolean;
  rates: StudioRate[];
  distanceKm?: number;
}

type RawStudio = {
  id: string;
  owner_user_id: string;
  name: string;
  tagline: string | null;
  about: string | null;
  hero_image_url: string | null;
  photos: unknown;
  amenities: unknown;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  zip_code: string | null;
  country: string | null;
  lat: number | null;
  lng: number | null;
  location_precision: string;
  contact_email: string | null;
  contact_phone: string | null;
  booking_link: string | null;
  is_published: boolean;
  created_at?: string;
  updated_at?: string;
  studio_rates?: Array<{
    id: string;
    label: string;
    price_cents: number;
    unit: string;
    notes: string | null;
    sort_order: number;
  }>;
  users?: { display_name?: string | null } | { display_name?: string | null }[];
};

const STUDIO_SELECT = `
  id,
  owner_user_id,
  name,
  tagline,
  about,
  hero_image_url,
  photos,
  amenities,
  address_line1,
  address_line2,
  city,
  state,
  zip_code,
  country,
  lat,
  lng,
  location_precision,
  contact_email,
  contact_phone,
  booking_link,
  is_published,
  created_at,
  updated_at,
  studio_rates (
    id,
    label,
    price_cents,
    unit,
    notes,
    sort_order
  ),
  users ( display_name )
`;

@Injectable()
export class StudiosService {
  async list(params: {
    search?: string;
    city?: string;
    lat?: number;
    lng?: number;
    radiusKm?: number;
    limit?: number;
  }): Promise<{ items: StudioPublic[]; total: number }> {
    const limit = Math.min(Math.max(params.limit ?? 60, 1), 200);
    const supabase = getSupabaseClient();
    let q = supabase
      .from('studios')
      .select(STUDIO_SELECT)
      .eq('is_published', true)
      .order('name', { ascending: true })
      .limit(limit);

    if (params.city?.trim()) {
      q = q.ilike('city', `%${params.city.trim()}%`);
    }
    if (params.search?.trim()) {
      const s = params.search.trim();
      q = q.or(`name.ilike.%${s}%,tagline.ilike.%${s}%,city.ilike.%${s}%`);
    }

    const { data, error } = await q;
    if (error) throw new Error(`Failed to list studios: ${error.message}`);

    let items = ((data ?? []) as RawStudio[]).map((row) =>
      this.toPublic(row, { includePrivateAddress: false }),
    );

    if (
      params.lat != null &&
      params.lng != null &&
      params.radiusKm != null &&
      params.radiusKm > 0
    ) {
      items = items
        .map((item) => {
          if (item.lat == null || item.lng == null) return item;
          return {
            ...item,
            distanceKm: haversineKm(
              params.lat!,
              params.lng!,
              item.lat,
              item.lng,
            ),
          };
        })
        .filter(
          (item) =>
            item.distanceKm != null && item.distanceKm <= params.radiusKm!,
        )
        .sort(
          (a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity),
        );
    }

    return { items, total: items.length };
  }

  async getOne(
    id: string,
    viewerUserId?: string,
  ): Promise<StudioPublic> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('studios')
      .select(STUDIO_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load studio: ${error.message}`);
    if (!data) throw new NotFoundException('Studio not found');
    const row = data as RawStudio;
    const isOwner = viewerUserId != null && row.owner_user_id === viewerUserId;
    if (!row.is_published && !isOwner) {
      throw new NotFoundException('Studio not found');
    }
    return this.toPublic(row, { includePrivateAddress: isOwner });
  }

  async listMine(userId: string): Promise<StudioPublic[]> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('studios')
      .select(STUDIO_SELECT)
      .eq('owner_user_id', userId)
      .order('created_at', { ascending: false });
    if (error) throw new Error(`Failed to load my studios: ${error.message}`);
    return ((data ?? []) as RawStudio[]).map((row) =>
      this.toPublic(row, { includePrivateAddress: true }),
    );
  }

  async create(userId: string, dto: CreateStudioDto): Promise<StudioPublic> {
    const supabase = getSupabaseClient();
    const geo = await this.resolveCoords(dto);
    const insertRow: Record<string, unknown> = {
      owner_user_id: userId,
      name: dto.name.trim(),
      tagline: trimOrNull(dto.tagline),
      about: trimOrNull(dto.about),
      hero_image_url: trimOrNull(dto.heroImageUrl),
      photos: sanitizeStringList(dto.photos, 12, 2048),
      amenities: sanitizeStringList(dto.amenities, 24, 40),
      address_line1: trimOrNull(dto.addressLine1),
      address_line2: trimOrNull(dto.addressLine2),
      city: trimOrNull(dto.city),
      state: trimOrNull(dto.state),
      zip_code: trimOrNull(dto.zipCode),
      country: trimOrNull(dto.country) ?? 'US',
      lat: geo?.lat ?? null,
      lng: geo?.lng ?? null,
      location_precision: normalizePrecision(dto.locationPrecision),
      contact_email: trimOrNull(dto.contactEmail),
      contact_phone: trimOrNull(dto.contactPhone),
      booking_link: trimOrNull(dto.bookingLink),
      is_published: dto.isPublished ?? true,
    };

    const { data, error } = await supabase
      .from('studios')
      .insert(insertRow)
      .select('id')
      .single();
    if (error || !data) {
      throw new Error(`Failed to create studio: ${error?.message ?? 'unknown'}`);
    }
    if (dto.rates) {
      await this.replaceRates(data.id as string, dto.rates);
    }
    return this.getOne(data.id as string, userId);
  }

  async update(
    userId: string,
    id: string,
    dto: UpdateStudioDto,
  ): Promise<StudioPublic> {
    const existing = await this.requireOwned(userId, id);
    const supabase = getSupabaseClient();

    const next = {
      addressLine1:
        dto.addressLine1 !== undefined
          ? dto.addressLine1
          : existing.address_line1,
      addressLine2:
        dto.addressLine2 !== undefined
          ? dto.addressLine2
          : existing.address_line2,
      city: dto.city !== undefined ? dto.city : existing.city,
      state: dto.state !== undefined ? dto.state : existing.state,
      zipCode: dto.zipCode !== undefined ? dto.zipCode : existing.zip_code,
      country: dto.country !== undefined ? dto.country : existing.country,
      locationPrecision:
        dto.locationPrecision !== undefined
          ? dto.locationPrecision
          : existing.location_precision,
    };

    const locationTouched =
      dto.addressLine1 !== undefined ||
      dto.city !== undefined ||
      dto.state !== undefined ||
      dto.zipCode !== undefined ||
      dto.country !== undefined ||
      dto.locationPrecision !== undefined;

    const geo = locationTouched ? await this.resolveCoords(next) : null;

    const updateRow: Record<string, unknown> = {
      updated_at: new Date().toISOString(),
    };
    if (dto.name !== undefined) updateRow.name = dto.name.trim();
    if (dto.tagline !== undefined) updateRow.tagline = trimOrNull(dto.tagline);
    if (dto.about !== undefined) updateRow.about = trimOrNull(dto.about);
    if (dto.heroImageUrl !== undefined) {
      updateRow.hero_image_url = trimOrNull(dto.heroImageUrl);
    }
    if (dto.photos !== undefined) {
      updateRow.photos = sanitizeStringList(dto.photos, 12, 2048);
    }
    if (dto.amenities !== undefined) {
      updateRow.amenities = sanitizeStringList(dto.amenities, 24, 40);
    }
    if (dto.addressLine1 !== undefined) {
      updateRow.address_line1 = trimOrNull(dto.addressLine1);
    }
    if (dto.addressLine2 !== undefined) {
      updateRow.address_line2 = trimOrNull(dto.addressLine2);
    }
    if (dto.city !== undefined) updateRow.city = trimOrNull(dto.city);
    if (dto.state !== undefined) updateRow.state = trimOrNull(dto.state);
    if (dto.zipCode !== undefined) updateRow.zip_code = trimOrNull(dto.zipCode);
    if (dto.country !== undefined) {
      updateRow.country = trimOrNull(dto.country) ?? 'US';
    }
    if (dto.locationPrecision !== undefined) {
      updateRow.location_precision = normalizePrecision(dto.locationPrecision);
    }
    if (dto.contactEmail !== undefined) {
      updateRow.contact_email = trimOrNull(dto.contactEmail);
    }
    if (dto.contactPhone !== undefined) {
      updateRow.contact_phone = trimOrNull(dto.contactPhone);
    }
    if (dto.bookingLink !== undefined) {
      updateRow.booking_link = trimOrNull(dto.bookingLink);
    }
    if (dto.isPublished !== undefined) {
      updateRow.is_published = dto.isPublished;
    }
    if (locationTouched) {
      updateRow.lat = geo?.lat ?? null;
      updateRow.lng = geo?.lng ?? null;
    }

    const { error } = await supabase.from('studios').update(updateRow).eq('id', id);
    if (error) throw new Error(`Failed to update studio: ${error.message}`);

    if (dto.rates !== undefined) {
      await this.replaceRates(id, dto.rates);
    }
    return this.getOne(id, userId);
  }

  async remove(userId: string, id: string): Promise<void> {
    await this.requireOwned(userId, id);
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('studios').delete().eq('id', id);
    if (error) throw new Error(`Failed to delete studio: ${error.message}`);
  }

  toPublic(
    row: RawStudio,
    opts: { includePrivateAddress: boolean },
  ): StudioPublic {
    const precision = normalizePrecision(row.location_precision);
    const ratesRaw = Array.isArray(row.studio_rates) ? row.studio_rates : [];
    const rates = [...ratesRaw]
      .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
      .map((r) => ({
        id: r.id,
        label: r.label,
        priceCents: r.price_cents,
        unit: normalizeRateUnit(r.unit),
        notes: r.notes ?? null,
        sortOrder: r.sort_order ?? 0,
      }));
    const starting = startingAtFromRates(ratesRaw);
    const rawLat =
      row.lat != null && Number.isFinite(Number(row.lat))
        ? Number(row.lat)
        : null;
    const rawLng =
      row.lng != null && Number.isFinite(Number(row.lng))
        ? Number(row.lng)
        : null;
    let lat: number | null = null;
    let lng: number | null = null;
    let vicinityRadiusKm: number | null = null;
    if (rawLat != null && rawLng != null) {
      const pub = publishStudioLocation(rawLat, rawLng, row.id, precision);
      lat = pub.lat;
      lng = pub.lng;
      vicinityRadiusKm = pub.vicinityRadiusKm;
    }
    const showStreet =
      precision === 'exact' || opts.includePrivateAddress;
    const owner = Array.isArray(row.users) ? row.users[0] : row.users;

    return {
      kind: 'studio',
      id: row.id,
      ownerUserId: row.owner_user_id,
      ownerDisplayName: owner?.display_name ?? null,
      name: row.name,
      tagline: row.tagline,
      about: row.about,
      heroImageUrl: row.hero_image_url,
      photos: asStringList(row.photos),
      amenities: asStringList(row.amenities),
      city: row.city,
      state: row.state,
      zipCode: row.zip_code,
      country: row.country,
      addressLine1: showStreet ? row.address_line1 : null,
      addressLine2: showStreet ? row.address_line2 : null,
      lat,
      lng,
      vicinityRadiusKm,
      locationPrecision: precision,
      startingAtCents: starting.cents,
      startingAtUnit: starting.unit,
      bookingLink: row.booking_link,
      contactEmail: row.contact_email,
      contactPhone: row.contact_phone,
      isPublished: row.is_published,
      rates,
    };
  }

  private async requireOwned(userId: string, id: string): Promise<RawStudio> {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from('studios')
      .select(STUDIO_SELECT)
      .eq('id', id)
      .maybeSingle();
    if (error) throw new Error(`Failed to load studio: ${error.message}`);
    if (!data) throw new NotFoundException('Studio not found');
    const row = data as RawStudio;
    if (row.owner_user_id !== userId) {
      throw new ForbiddenException('You do not own this studio');
    }
    return row;
  }

  private async resolveCoords(parts: {
    addressLine1?: string | null;
    city?: string | null;
    state?: string | null;
    zipCode?: string | null;
    country?: string | null;
    locationPrecision?: string | null;
  }) {
    const precision = normalizePrecision(parts.locationPrecision);
    if (precision === 'exact') {
      return geocodeAddress({
        addressLine1: parts.addressLine1,
        city: parts.city,
        state: parts.state,
        zip: parts.zipCode,
        country: parts.country,
      });
    }
    return geocodeCityZip(parts.city ?? '', parts.zipCode);
  }

  private async replaceRates(
    studioId: string,
    rates: StudioRateDto[],
  ): Promise<void> {
    const supabase = getSupabaseClient();
    const { error: delError } = await supabase
      .from('studio_rates')
      .delete()
      .eq('studio_id', studioId);
    if (delError) {
      throw new Error(`Failed to replace rates: ${delError.message}`);
    }
    if (rates.length === 0) return;
    const rows = rates.map((r, i) => ({
      studio_id: studioId,
      label: r.label.trim(),
      price_cents: r.priceCents,
      unit: normalizeRateUnit(r.unit),
      notes: trimOrNull(r.notes),
      sort_order: i,
    }));
    const { error } = await supabase.from('studio_rates').insert(rows);
    if (error) throw new Error(`Failed to save rates: ${error.message}`);
  }
}

function trimOrNull(value?: string | null): string | null {
  const t = (value ?? '').trim();
  return t.length > 0 ? t : null;
}

function asStringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => (typeof v === 'string' ? v.trim() : ''))
    .filter((v) => v.length > 0);
}

function sanitizeStringList(
  value: string[] | undefined,
  maxItems: number,
  maxLen: number,
): string[] {
  if (!value) return [];
  const out: string[] = [];
  for (const raw of value) {
    const t = (raw ?? '').trim().slice(0, maxLen);
    if (!t || out.includes(t)) continue;
    out.push(t);
    if (out.length >= maxItems) break;
  }
  return out;
}

function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
