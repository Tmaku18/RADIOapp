'use client';

import { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export default function SocialPage() {
  const router = useRouter();
  const [query, setQuery] = useState('');

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = query.trim();
    if (!q) {
      router.push('/discover?tab=artist');
      return;
    }
    router.push(`/discover?tab=artist&q=${encodeURIComponent(q)}`);
  };

  return (
    <div className="container max-w-5xl py-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground tracking-tight">Social</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Your Instagram-style hub for scrolling, searching users, following, and DMs.
        </p>
      </div>

      <Card className="border-border/80">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg">Search users</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2">
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search artists or catalysts..."
              className="bg-background"
            />
            <Button type="submit">Search</Button>
          </form>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Scroll feed</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Browse the social feed like Instagram and discover new creators.
            </p>
            <Button asChild className="w-full">
              <Link href="/discover?tab=feed">Open feed</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Discover people</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button asChild variant="secondary" className="w-full">
              <Link href="/discover?tab=artist">Artists</Link>
            </Button>
            <Button asChild variant="outline" className="w-full">
              <Link href="/discover?tab=service_provider">Catalysts</Link>
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Direct messages</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Open DMs. Follow first, then message instantly.
            </p>
            <Button asChild variant="outline" className="w-full">
              <Link href="/messages">Open DMs</Link>
            </Button>
          </CardContent>
        </Card>
      </div>

      <Card className="border-border/80">
        <CardContent className="pt-6">
          <p className="text-sm text-muted-foreground">
            Suggested flow: <span className="text-foreground font-medium">Scroll</span> to discover creators,{' '}
            <span className="text-foreground font-medium">Follow</span> from profile cards, then{' '}
            <span className="text-foreground font-medium">DM</span>.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
