'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { adminApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import { ScrollArea } from '@/components/ui/scroll-area';

interface FeedMediaItem {
  id: string;
  type: string;
  fileUrl: string;
  title: string | null;
  description: string | null;
  createdAt: string;
  optInFeed: boolean;
  feedRemovedAt: string | null;
  provider: { userId: string; displayName: string | null };
  likeCount: number;
  reportCount: number;
  reports: Array<{ reason: string; createdAt: string; userId: string }>;
}

export default function AdminFeedPage() {
  const [items, setItems] = useState<FeedMediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [reportedOnly, setReportedOnly] = useState(false);
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemoveId, setConfirmRemoveId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await adminApi.getFeedMedia(reportedOnly);
      setItems((res.data as { items: FeedMediaItem[] }).items ?? []);
    } catch (e) {
      console.error('Failed to load feed media:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [reportedOnly]);

  const handleRemove = async (contentId: string) => {
    setRemovingId(contentId);
    setConfirmRemoveId(null);
    try {
      await adminApi.removeFromFeed(contentId);
      setItems((prev) => prev.filter((i) => i.id !== contentId));
    } catch (e) {
      console.error('Remove failed:', e);
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm mb-4">
            Media opted in by users appears in the Browse feed. Remove items to hide them from the feed. Ranked by likes (most popular first).
          </p>
          <Tabs value={reportedOnly ? 'reported' : 'all'} onValueChange={(v) => setReportedOnly(v === 'reported')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="all">All media</TabsTrigger>
              <TabsTrigger value="reported">Reported only</TabsTrigger>
            </TabsList>
          </Tabs>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              {reportedOnly ? 'No reported media.' : 'No feed-eligible media yet.'}
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[80px]">Preview</TableHead>
                    <TableHead>Title / Creator</TableHead>
                    <TableHead className="text-center">Likes</TableHead>
                    <TableHead className="text-center">Reports</TableHead>
                    <TableHead className="w-[100px]">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((row) => (
                    <Collapsible
                      key={row.id}
                      open={expandedId === row.id}
                      onOpenChange={(open) => setExpandedId(open ? row.id : null)}
                    >
                      <TableRow>
                        <TableCell>
                          <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0">
                            {row.type === 'image' ? (
                              <Image
                                src={row.fileUrl}
                                alt={row.title ?? ''}
                                fill
                                className="object-cover"
                                sizes="56px"
                                unoptimized={row.fileUrl.startsWith('http') && !row.fileUrl.includes('supabase')}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-lg">
                                🎵
                              </div>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium truncate max-w-[200px]">{row.title || 'Untitled'}</p>
                            <p className="text-xs text-muted-foreground">{row.provider.displayName || row.provider.userId}</p>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          <Badge variant="secondary">{row.likeCount}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {row.reportCount > 0 ? (
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1">
                                <Badge variant="destructive">{row.reportCount}</Badge>
                                {expandedId === row.id ? 'Hide' : 'View'}
                              </Button>
                            </CollapsibleTrigger>
                          ) : (
                            <span className="text-muted-foreground text-sm">0</span>
                          )}
                        </TableCell>
                        <TableCell>
                          {row.feedRemovedAt ? (
                            <span className="text-muted-foreground text-sm">Removed</span>
                          ) : (
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={removingId === row.id}
                              onClick={() => setConfirmRemoveId(row.id)}
                            >
                              {removingId === row.id ? '…' : 'Remove from feed'}
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                      <CollapsibleContent asChild>
                        <>
                          <TableRow>
                            <TableCell colSpan={5} className="bg-muted/40">
                              <div className="py-2 px-2">
                                <p className="text-sm font-medium mb-2">Report reasons</p>
                                <ul className="space-y-1 text-sm text-muted-foreground">
                                  {row.reports.map((r, i) => (
                                    <li key={i}>
                                      &ldquo;{r.reason}&rdquo;
                                      <span className="ml-2 text-xs">— {new Date(r.createdAt).toLocaleString()}</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </TableCell>
                          </TableRow>
                        </>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!confirmRemoveId} onOpenChange={() => setConfirmRemoveId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove from feed?</AlertDialogTitle>
            <AlertDialogDescription>
              This will hide the item from the Browse feed. It can be re-approved later if you add an option to restore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmRemoveId && handleRemove(confirmRemoveId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
