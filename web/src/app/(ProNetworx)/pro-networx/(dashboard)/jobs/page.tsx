'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { jobBoardApi, proNetworkSubscriptionApi } from '@/lib/api';
import { PaywallCard } from '@/components/pro-networx/PaywallCard';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface ServiceRequestRow {
  id: string;
  artistId: string;
  title: string;
  description: string | null;
  serviceType: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  artistDisplayName?: string | null;
}

interface ServiceRequestApplicationRow {
  id: string;
  requestId: string;
  applicantId: string;
  message: string | null;
  status: string;
  createdAt: string;
  applicantDisplayName?: string | null;
}

const SERVICE_TYPES = [
  'mixing',
  'mastering',
  'production',
  'session',
  'collab',
  'design',
  'video',
  'marketing',
  'other',
];

export default function ProNetworxJobsPage() {
  const { profile } = useAuth();
  const myId = profile?.id ?? null;
  const [tab, setTab] = useState<'browse' | 'mine'>('browse');
  const [items, setItems] = useState<ServiceRequestRow[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [serviceType, setServiceType] = useState<string>('all');
  const [status, setStatus] = useState<'open' | 'closed' | 'all'>('open');

  const [selectedRequest, setSelectedRequest] = useState<ServiceRequestRow | null>(null);
  const [requestDetail, setRequestDetail] = useState<ServiceRequestRow | null>(null);
  const [applications, setApplications] = useState<ServiceRequestApplicationRow[]>([]);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [applyOpen, setApplyOpen] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');
  const [applying, setApplying] = useState(false);
  const [applySuccess, setApplySuccess] = useState(false);

  const [hasSubscription, setHasSubscription] = useState<boolean | null>(null);
  const [paywalled, setPaywalled] = useState(false);

  // On Pro-Networx, any signed-in member can post a request (ask for help).
  const canPost = !!profile;
  const [createOpen, setCreateOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newServiceType, setNewServiceType] = useState<string>('none');
  const [newDescription, setNewDescription] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const loadRequests = useCallback(
    async (mine: boolean) => {
      setLoading(true);
      try {
        const res = await jobBoardApi.listRequests({
          serviceType: serviceType === 'all' ? undefined : serviceType,
          status: tab === 'mine' ? undefined : status,
          mine,
          limit: 30,
          offset: 0,
        });
        const data = res.data as { items: ServiceRequestRow[]; total: number };
        setItems(data.items);
        setTotal(data.total);
      } catch (e) {
        console.error('Failed to load requests:', e);
        setItems([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [serviceType, status, tab],
  );

  useEffect(() => {
    if (profile) loadRequests(tab === 'mine');
  }, [tab, loadRequests, profile]);

  useEffect(() => {
    if (!profile) return;
    let alive = true;
    (async () => {
      try {
        const res = await proNetworkSubscriptionApi.getAccess();
        if (alive) setHasSubscription(!!res.data?.hasAccess);
      } catch {
        if (alive) setHasSubscription(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [profile]);

  const loadDetail = useCallback(
    async (requestId: string, currentUserId: string | undefined) => {
      setLoadingDetail(true);
      try {
        const reqRes = await jobBoardApi.getRequest(requestId);
        const req = reqRes.data as ServiceRequestRow;
        setRequestDetail(req);
        if (req.artistId === currentUserId) {
          const appsRes = await jobBoardApi.listApplications(requestId);
          setApplications((appsRes.data as ServiceRequestApplicationRow[]) ?? []);
        } else {
          setApplications([]);
        }
      } catch (e) {
        console.error('Failed to load request:', e);
        setRequestDetail(null);
        setApplications([]);
      } finally {
        setLoadingDetail(false);
      }
    },
    [],
  );

  useEffect(() => {
    if (selectedRequest?.id) {
      setPaywalled(false);
      loadDetail(selectedRequest.id, myId ?? undefined);
    }
  }, [selectedRequest?.id, myId, loadDetail]);

  const handleApply = async () => {
    if (!selectedRequest || applying) return;
    setApplying(true);
    try {
      await jobBoardApi.apply(selectedRequest.id, applyMessage.trim() || undefined);
      setApplySuccess(true);
      setApplyMessage('');
      setApplyOpen(false);
      loadDetail(selectedRequest.id, myId ?? undefined);
    } catch (e: unknown) {
      const data =
        e && typeof e === 'object'
          ? (e as { response?: { data?: { requiresSubscription?: boolean } } })
              .response?.data
          : undefined;
      if (data?.requiresSubscription) {
        setHasSubscription(false);
        setApplyOpen(false);
        setPaywalled(true);
      } else {
        console.error('Apply failed:', e);
      }
    } finally {
      setApplying(false);
    }
  };

  const handleCreate = async () => {
    const title = newTitle.trim();
    if (!title || creating) {
      if (!title) setCreateError('A title is required.');
      return;
    }
    setCreating(true);
    setCreateError(null);
    try {
      await jobBoardApi.createRequest({
        title,
        description: newDescription.trim() || null,
        serviceType: newServiceType === 'none' ? null : newServiceType,
      });
      setCreateOpen(false);
      setNewTitle('');
      setNewServiceType('none');
      setNewDescription('');
      setTab('mine');
      loadRequests(true);
    } catch (e: unknown) {
      const msg =
        e && typeof e === 'object'
          ? ((e as { response?: { data?: { message?: unknown } } }).response
              ?.data?.message as string | undefined)
          : undefined;
      setCreateError(msg ?? 'Could not post your request.');
    } finally {
      setCreating(false);
    }
  };

  const isOwner = myId && requestDetail && requestDetail.artistId === myId;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-artist-pro p-6">
        <div className="absolute inset-0 opacity-25 bg-networx blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h1 className="text-2xl font-semibold text-white">Jobs</h1>
              <p className="text-white/80 text-sm mt-1">
                Post what you need and let Catalysts come to you—or browse open
                requests and apply.
              </p>
            </div>
            {canPost && (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setCreateError(null);
                  setCreateOpen(true);
                }}
              >
                Post a request
              </Button>
            )}
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as 'browse' | 'mine')}>
        <TabsList>
          <TabsTrigger value="browse">Browse requests</TabsTrigger>
          <TabsTrigger value="mine">My requests</TabsTrigger>
        </TabsList>

        {tab === 'browse' && (
          <div className="flex flex-wrap gap-2 mt-4">
            <Select value={serviceType} onValueChange={setServiceType}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Service type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All types</SelectItem>
                {SERVICE_TYPES.map((st) => (
                  <SelectItem key={st} value={st}>
                    {st}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={status} onValueChange={(v) => setStatus(v as typeof status)}>
              <SelectTrigger className="w-[120px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="closed">Closed</SelectItem>
                <SelectItem value="all">All</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        <TabsContent value="browse" className="mt-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{total} request(s) found</p>
              {items.map((req) => (
                <Card
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedRequest(req)}
                >
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-muted-foreground">
                        by{' '}
                        <Link
                          href={`/pro-networx/u/${req.artistId}`}
                          className="hover:underline"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {req.artistDisplayName || 'Member'}
                        </Link>{' '}
                        · {req.serviceType || 'General'}
                      </p>
                    </div>
                    <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>
                      {req.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  No requests match your filters.
                </p>
              )}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                {total} request(s) you posted
              </p>
              {items.map((req) => (
                <Card
                  key={req.id}
                  className="cursor-pointer hover:bg-muted/50 transition-colors"
                  onClick={() => setSelectedRequest(req)}
                >
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-muted-foreground">
                        {req.serviceType || 'General'} · {req.status}
                      </p>
                    </div>
                    <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>
                      {req.status}
                    </Badge>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <div className="text-center py-8 space-y-3">
                  <p className="text-muted-foreground">
                    You haven&apos;t posted any requests yet.
                  </p>
                  {canPost && (
                    <Button
                      onClick={() => {
                        setCreateError(null);
                        setCreateOpen(true);
                      }}
                    >
                      Post a request
                    </Button>
                  )}
                </div>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog
        open={!!selectedRequest}
        onOpenChange={(open) => !open && setSelectedRequest(null)}
      >
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : requestDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>{requestDetail.title}</DialogTitle>
                <DialogDescription>
                  by{' '}
                  <Link
                    href={`/pro-networx/u/${requestDetail.artistId}`}
                    className="text-primary underline"
                  >
                    {requestDetail.artistDisplayName || 'Member'}
                  </Link>
                  {requestDetail.serviceType && <> · {requestDetail.serviceType}</>}
                  <Badge variant="secondary" className="ml-2">
                    {requestDetail.status}
                  </Badge>
                </DialogDescription>
              </DialogHeader>
              {requestDetail.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {requestDetail.description}
                </p>
              )}

              {isOwner ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">
                    Applications ({applications.length})
                  </h3>
                  {applications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No applications yet.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {applications.map((app) => (
                        <li key={app.id} className="rounded-lg border p-3 text-sm">
                          <Link
                            href={`/pro-networx/u/${app.applicantId}`}
                            className="font-medium hover:underline"
                          >
                            {app.applicantDisplayName || 'Someone'}
                          </Link>
                          {app.message && (
                            <p className="text-muted-foreground mt-1">{app.message}</p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(app.createdAt).toLocaleString()}
                          </p>
                          <Badge variant="outline" className="mt-1">
                            {app.status}
                          </Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  {requestDetail.status === 'open' && (
                    <>
                      {hasSubscription === false || paywalled ? (
                        <PaywallCard
                          variant="dm"
                          className="mt-2"
                          caption="Applying and messaging members on Pro-Networx unlocks with a subscription. Browsing is always free."
                        />
                      ) : (
                        <Button
                          onClick={() => setApplyOpen(true)}
                          className="w-full mt-2"
                          disabled={hasSubscription === null}
                        >
                          Apply to this request
                        </Button>
                      )}
                    </>
                  )}
                </>
              )}

              <DialogFooter>
                <Button variant="outline" asChild>
                  <Link href={`/pro-networx/u/${requestDetail.artistId}`}>
                    View profile
                  </Link>
                </Button>
                <Button variant="ghost" onClick={() => setSelectedRequest(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to &quot;{selectedRequest?.title}&quot;</DialogTitle>
            <DialogDescription>
              Add a short message to introduce yourself (optional).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="apply-msg">Message</Label>
            <Textarea
              id="apply-msg"
              placeholder="I'd like to help with..."
              value={applyMessage}
              onChange={(e) => setApplyMessage(e.target.value)}
              rows={3}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setApplyOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? 'Sending...' : 'Submit application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {applySuccess && (
        <p className="text-sm text-green-600 text-center">
          Application submitted. The poster will see it in their &quot;My
          requests&quot; tab.
        </p>
      )}

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Post a request</DialogTitle>
            <DialogDescription>
              Tell the network what you need. Open requests appear in Browse for
              Catalysts to apply.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="req-title">Title</Label>
              <Input
                id="req-title"
                placeholder="e.g. Need a mix engineer for a 3-track EP"
                value={newTitle}
                maxLength={120}
                onChange={(e) => setNewTitle(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Service type</Label>
              <Select value={newServiceType} onValueChange={setNewServiceType}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">General</SelectItem>
                  {SERVICE_TYPES.map((st) => (
                    <SelectItem key={st} value={st}>
                      {st}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="req-desc">Details (optional)</Label>
              <Textarea
                id="req-desc"
                placeholder="Describe the work, budget, timeline, references..."
                value={newDescription}
                onChange={(e) => setNewDescription(e.target.value)}
                rows={4}
              />
            </div>
            {createError && <p className="text-sm text-destructive">{createError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={creating || !newTitle.trim()}>
              {creating ? 'Posting…' : 'Post request'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
