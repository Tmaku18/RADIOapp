'use client';

import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

const MESSAGE =
  'The Pro-Network is an exclusive hub for verified Networx Artists. Want to move from the crowd to the stage?';

export default function ApplyPage() {
  const searchParams = useSearchParams();
  const from = searchParams.get('from') ?? '';

  return (
    <div className="max-w-lg mx-auto py-12 px-4">
      <Card className="border-primary/30 bg-card overflow-hidden">
        <div className="bg-primary/10 border-b border-primary/20 px-6 py-4">
          <span className="text-4xl" aria-hidden>🔒</span>
          <h1 className="text-2xl font-bold text-foreground mt-2">Pro-Network</h1>
        </div>
        <CardContent className="pt-6 pb-8">
          <p className="text-muted-foreground mb-6">{MESSAGE}</p>
          <div className="flex flex-col sm:flex-row gap-3">
            <Button asChild size="lg" className="bg-primary text-primary-foreground hover:opacity-90">
              <Link href="/signup?role=artist">Apply for Artist Status</Link>
            </Button>
            {from && (
              <Button asChild variant="outline" size="lg">
                <Link href="/dashboard">Back to Dashboard</Link>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
