'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
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

interface PostReportItem {
  postId: string;
  imageUrl: string;
  mediaType: 'image' | 'video';
  caption: string | null;
  createdAt: string;
  author: {
    userId: string;
    displayName: string | null;
    username: string | null;
  };
  reportCount: number;
  reports: Array<{
    reason: string;
    createdAt: string;
    reporter: { userId: string; displayName: string | null };
  }>;
}

interface UserReportItem {
  id: string;
  reason: string;
  createdAt: string;
  contextType: string | null;
  contextId: string | null;
  reporter: { userId: string; displayName: string | null };
  reportedUser: {
    userId: string;
    displayName: string | null;
    username: string | null;
    role: string | null;
  };
}

function formatDate(value: string) {
  return new Date(value).toLocaleString();
}

function displayName(user: { displayName: string | null; userId: string; username?: string | null }) {
  return user.displayName || user.username || user.userId.slice(0, 8);
}

export default function AdminReportsPage() {
  const [tab, setTab] = useState<'posts' | 'users'>('posts');
  const [postItems, setPostItems] = useState<PostReportItem[]>([]);
  const [userItems, setUserItems] = useState<UserReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedPostId, setExpandedPostId] = useState<string | null>(null);
  const [deletingPostId, setDeletingPostId] = useState<string | null>(null);
  const [confirmDeletePostId, setConfirmDeletePostId] = useState<string | null>(null);

  const loadPosts = async () => {
    const res = await adminApi.getPostReports();
    setPostItems((res.data as { items: PostReportItem[] }).items ?? []);
  };

  const loadUsers = async () => {
    const res = await adminApi.getUserReports();
    setUserItems((res.data as { items: UserReportItem[] }).items ?? []);
  };

  const load = async () => {
    setLoading(true);
    try {
      if (tab === 'posts') {
        await loadPosts();
      } else {
        await loadUsers();
      }
    } catch (e) {
      console.error('Failed to load reports:', e);
      if (tab === 'posts') setPostItems([]);
      else setUserItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [tab]);

  const handleDeletePost = async (postId: string) => {
    setDeletingPostId(postId);
    setConfirmDeletePostId(null);
    try {
      await adminApi.deleteDiscoverFeedPost(postId);
      setPostItems((prev) => prev.filter((p) => p.postId !== postId));
      if (expandedPostId === postId) setExpandedPostId(null);
    } catch (e) {
      console.error('Delete post failed:', e);
    } finally {
      setDeletingPostId(null);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="pt-6">
          <p className="text-muted-foreground text-sm mb-4">
            Review user-submitted reports from the Pro Networx feed. Delete posts that violate community guidelines.
          </p>
          <Tabs value={tab} onValueChange={(v) => setTab(v as 'posts' | 'users')}>
            <TabsList className="grid w-full max-w-xs grid-cols-2">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              <TabsTrigger value="users">Users</TabsTrigger>
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
          ) : tab === 'posts' ? (
            postItems.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                No reported posts yet.
              </div>
            ) : (
              <ScrollArea className="w-full">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-[80px]">Preview</TableHead>
                      <TableHead>Post / Author</TableHead>
                      <TableHead className="text-center">Reports</TableHead>
                      <TableHead className="w-[140px]">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {postItems.map((row) => (
                      <Collapsible
                        key={row.postId}
                        open={expandedPostId === row.postId}
                        onOpenChange={(open) =>
                          setExpandedPostId(open ? row.postId : null)
                        }
                      >
                        <TableRow>
                          <TableCell>
                            <div className="relative h-14 w-14 rounded-lg overflow-hidden bg-muted shrink-0">
                              {row.mediaType === 'image' ? (
                                <Image
                                  src={row.imageUrl}
                                  alt={row.caption ?? 'Post'}
                                  fill
                                  className="object-cover"
                                  sizes="56px"
                                  unoptimized={
                                    row.imageUrl.startsWith('http') &&
                                    !row.imageUrl.includes('supabase')
                                  }
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground text-lg">
                                  ▶
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <p className="font-medium truncate max-w-[260px]">
                                {row.caption || 'No caption'}
                              </p>
                              <Link
                                href={`/pro-networx/u/${row.author.userId}`}
                                className="text-xs text-primary hover:underline"
                              >
                                {displayName(row.author)}
                              </Link>
                              <p className="text-xs text-muted-foreground mt-0.5">
                                Posted {formatDate(row.createdAt)}
                              </p>
                            </div>
                          </TableCell>
                          <TableCell className="text-center">
                            <CollapsibleTrigger asChild>
                              <Button variant="outline" size="sm" className="gap-1">
                                <Badge variant="destructive">{row.reportCount}</Badge>
                                {expandedPostId === row.postId ? 'Hide' : 'View'}
                              </Button>
                            </CollapsibleTrigger>
                          </TableCell>
                          <TableCell>
                            <Button
                              variant="destructive"
                              size="sm"
                              disabled={deletingPostId === row.postId}
                              onClick={() => setConfirmDeletePostId(row.postId)}
                            >
                              {deletingPostId === row.postId ? '…' : 'Delete post'}
                            </Button>
                          </TableCell>
                        </TableRow>
                        <CollapsibleContent asChild>
                          <TableRow>
                            <TableCell colSpan={4} className="bg-muted/40">
                              <div className="py-2 px-2">
                                <p className="text-sm font-medium mb-2">Report details</p>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                  {row.reports.map((r, i) => (
                                    <li key={i}>
                                      <span className="text-foreground">&ldquo;{r.reason}&rdquo;</span>
                                      <span className="ml-2 text-xs">
                                        — reported by{' '}
                                        <Link
                                          href={`/pro-networx/u/${r.reporter.userId}`}
                                          className="text-primary hover:underline"
                                        >
                                          {displayName(r.reporter)}
                                        </Link>{' '}
                                        on {formatDate(r.createdAt)}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            </TableCell>
                          </TableRow>
                        </CollapsibleContent>
                      </Collapsible>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )
          ) : userItems.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No reported users yet.
            </div>
          ) : (
            <ScrollArea className="w-full">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Reported user</TableHead>
                    <TableHead>Reporter</TableHead>
                    <TableHead>Reason</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead>Date</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {userItems.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/pro-networx/u/${row.reportedUser.userId}`}
                          className="font-medium text-primary hover:underline"
                        >
                          {displayName(row.reportedUser)}
                        </Link>
                        {row.reportedUser.role && (
                          <Badge variant="secondary" className="ml-2 text-xs">
                            {row.reportedUser.role}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <Link
                          href={`/pro-networx/u/${row.reporter.userId}`}
                          className="text-primary hover:underline"
                        >
                          {displayName(row.reporter)}
                        </Link>
                      </TableCell>
                      <TableCell className="max-w-[220px]">
                        <span className="line-clamp-2">&ldquo;{row.reason}&rdquo;</span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {row.contextType
                          ? `${row.contextType}${row.contextId ? ` · ${row.contextId.slice(0, 8)}…` : ''}`
                          : '—'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                        {formatDate(row.createdAt)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      <AlertDialog
        open={!!confirmDeletePostId}
        onOpenChange={() => setConfirmDeletePostId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this post?</AlertDialogTitle>
            <AlertDialogDescription>
              This permanently removes the post, its media, and all related engagement. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmDeletePostId) void handleDeletePost(confirmDeletePostId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete post
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
