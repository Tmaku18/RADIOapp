import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

@Injectable()
export class VenueAdsService {
  async getCurrentAd(stationId: string = 'global') {
    const supabase = getSupabaseClient();
    const now = new Date();
    const { data: rows } = await supabase
      .from('venue_ads')
      .select('id, image_url, link_url, station_id, start_at, end_at, sort_order')
      .eq('station_id', stationId)
      .eq('is_active', true)
      .order('sort_order', { ascending: true });
    if (!rows?.length) return null;
    const current = (rows as { id: string; image_url: string; link_url: string | null; station_id: string; start_at: string | null; end_at: string | null }[]).find((r) => {
      if (r.start_at != null && new Date(r.start_at) > now) return false;
      if (r.end_at != null && new Date(r.end_at) < now) return false;
      return true;
    });
    if (!current) return null;
    return {
      id: current.id,
      imageUrl: current.image_url,
      linkUrl: current.link_url ?? null,
      stationId: current.station_id,
    };
  }
}
