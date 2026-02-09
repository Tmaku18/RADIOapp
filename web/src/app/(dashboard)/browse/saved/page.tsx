'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { browseApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface BrowseFeedItem {
  id: string;
  type: 'image' | 'audio';
  fileUrl: string;
  title: string | null;
  description: string | null;
  provider: {
    userId: string;
    displayName: string | null;
    avatarUrl: string | null;
  };
  likeCount: number;
  bookmarkCount: number;
  bookmarked?: boolean;
}

export default function BrowseSavedPage() {
  const [items, setItems] = useState<BrowseFeedItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    browseApi
      .getBookmarks({ limit: 100 })
      .then((res) => setItems(res.data as BrowseFeedItem[]))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, []);

  const removeBookmark = async (item: BrowseFeedItem) => {
    try {
      await browseApi.removeBookmark(item.id);
      setItems((prev) => prev.filter((i) => i.id !== item.id));
    } catch (e) {
      console.error('Remove bookmark failed:', e);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary" />
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="text-center py-16 text-muted-foreground">
        <p className="text-lg">No saved items.</p>
        <p className="text-sm mt-2">Bookmark content from the Browse feed to see it here.</p>
        <Button asChild className="mt-4">
          <Link href="/browse">Browse</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-semibold">Saved</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="overflow-hidden">
            <CardContent className="p-0">
              <div className="aspect-square relative bg-muted">
                {item.type === 'image' ? (
                  <Image
                    src={item.fileUrl}
                    alt={item.title ?? 'Portfolio'}
                    fill
                    className="object-cover"
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                    unoptimized={item.fileUrl.startsWith('http') && !item.fileUrl.includes('supabase')}
                  />
                ) : (
                  <div className="absolute inset-0 flex items-center justify-center bg-muted">
                    <audio
                      src={item.fileUrl}
                      controls
                      className="w-full max-w-full px-2"
                      preload="metadata"
                    />
                  </div>
                )}
                <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                  <Link
                    href={`/artist/${item.provider.userId}`}
                    className="flex items-center gap-2 rounded-full bg-black/50 px-2 py-1 text-white text-sm hover:bg-black/70"
                  >
                    {item.provider.avatarUrl ? (
                      <Image
                        src={item.provider.avatarUrl}
                        alt=""
                        width={24}
                        height={24}
                        className="rounded-full"
                      />
                    ) : (
                      <span className="w-6 h-6 rounded-full bg-white/30 flex items-center justify-center text-xs">
                        {item.provider.displayName?.[0] ?? '?'}
                      </span>
                    )}
                    <span className="truncate max-w-[120px]">
                      {item.provider.displayName ?? 'Creator'}
                    </span>
                  </Link>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 rounded-full bg-black/50 text-white hover:bg-black/70"
                    onClick={() => removeBookmark(item)}
                  >
                    🗑️
                  </Button>
                </div>
              </div>
              <div className="p-3">
                {item.title && (
                  <p className="font-medium text-foreground truncate">{item.title}</p>
                )}
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {item.description}
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
