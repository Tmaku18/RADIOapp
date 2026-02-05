import { Injectable } from '@nestjs/common';
import { getSupabaseClient } from '../config/supabase.config';

export interface NewsPromotionItem {
  id: string;
  type: 'news' | 'promotion';
  title: string;
  bodyOrDescription: string | null;
  imageUrl: string | null;
  linkUrl: string | null;
  startsAt: string | null;
  endsAt: string | null;
  sortOrder: number;
  createdAt: string;
}

@Injectable()
export class FeedService {
  async getNewsPromotions(limit: number): Promise<NewsPromotionItem[]> {
    const supabase = getSupabaseClient();
    const now = new Date().toISOString();
    const { data: rows, error } = await supabase
      .from('news_promotions')
      .select('id, type, title, body_or_description, image_url, link_url, starts_at, ends_at, sort_order, created_at')
      .eq('is_active', true)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit * 2);
    if (error) throw new Error(`Failed to fetch news/promotions: ${error.message}`);
    const data = (rows || []).filter(
      (r: any) =>
        (!r.starts_at || r.starts_at <= now) && (!r.ends_at || r.ends_at >= now),
    ).slice(0, limit);

    return data.map((r: any) => ({
      id: r.id,
      type: r.type,
      title: r.title,
      bodyOrDescription: r.body_or_description,
      imageUrl: r.image_url,
      linkUrl: r.link_url,
      startsAt: r.starts_at,
      endsAt: r.ends_at,
      sortOrder: r.sort_order ?? 0,
      createdAt: r.created_at,
    }));
  }
}
