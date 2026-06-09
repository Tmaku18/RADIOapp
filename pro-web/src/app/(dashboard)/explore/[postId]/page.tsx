'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useParams } from 'next/navigation';
import { discoveryApi, type DiscoverFeedPost } from '@/lib/api';
import { Button } from '@/components/ui/button';

export default function ExplorePostPage() {
  const params = useParams();
  const postId = params.postId as string;
  const [post, setPost] = useState<DiscoverFeedPost | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const res = await discoveryApi.exploreStream({
          anchorPostId: postId,
          limit: 1,
        });
        setPost(res.data.items[0] ?? null);
      } catch {
        setPost(null);
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [postId]);

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!post) {
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center space-y-4">
        <p className="text-muted-foreground">Post not found.</p>
        <Button asChild variant="outline"><Link href="/search">Back to search</Link></Button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
      <Button variant="ghost" asChild><Link href="/search">← Search</Link></Button>
      <div className="relative aspect-square rounded-xl overflow-hidden bg-muted">
        {post.mediaType === 'video' ? (
          <video src={post.imageUrl} controls playsInline className="w-full h-full object-cover" />
        ) : (
          <Image src={post.imageUrl} alt={post.caption || 'Post'} fill className="object-cover" unoptimized />
        )}
      </div>
      {post.caption && <p className="text-sm whitespace-pre-wrap">{post.caption}</p>}
      <Button asChild variant="outline"><Link href={`/u/${post.authorUserId}`}>View creator</Link></Button>
    </div>
  );
}
