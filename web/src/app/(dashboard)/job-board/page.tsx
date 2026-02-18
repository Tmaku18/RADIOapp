'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { jobBoardApi } from '@/lib/api';
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

const SERVICE_TYPES = ['mixing', 'mastering', 'production', 'session', 'collab', 'other'];

export default function JobBoardPage() {
  const { profile } = useAuth();
  const myId = profile?.id ?? null;
  const router = useRouter();
  const pathname = usePathname();
  const isArtist = profile?.role === 'artist' || profile?.role === 'admin';

  useEffect(() => {
    if (profile && !isArtist) {
      router.replace('/apply?from=' + encodeURIComponent(pathname || '/job-board'));
    }
  }, [profile, isArtist, router, pathname]);

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
    if (isArtist) loadRequests(tab === 'mine');
  }, [tab, loadRequests, isArtist]);

  const loadDetail = useCallback(async (requestId: string, currentUserId: string | undefined) => {
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
  }, []);

  useEffect(() => {
    if (selectedRequest?.id) loadDetail(selectedRequest.id, myId ?? undefined);
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
    } catch (e) {
      console.error('Apply failed:', e);
    } finally {
      setApplying(false);
    }
  };

  const isOwner = myId && requestDetail && requestDetail.artistId === myId;

  if (profile && !isArtist) {
    return (
      <div className="flex items-center justify-center min-h-48">
        <p className="text-muted-foreground">Redirecting...</p>
      </div>
    );
  }

  return (
    <div className="container max-w-4xl py-6 space-y-6">
      <div className="relative overflow-hidden rounded-2xl border border-primary/30 bg-artist-pro p-6">
        <div className="absolute inset-0 opacity-25 bg-networx blur-3xl" />
        <div className="relative">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <h1 className="text-2xl font-semibold text-white">Pro-Network</h1>
            <Badge className="badge-verified border border-black/10">Verified</Badge>
          </div>
          <p className="text-white/80 text-sm mt-1">
            Exclusive service requests and collaborations for creators.
          </p>
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
                  <SelectItem key={st} value={st}>{st}</SelectItem>
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
                <Card key={req.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedRequest(req)}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-muted-foreground">
                        by {req.artistDisplayName || 'Artist'} · {req.serviceType || 'General'}
                      </p>
                    </div>
                    <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>{req.status}</Badge>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && <p className="text-center text-muted-foreground py-8">No requests match your filters.</p>}
            </div>
          )}
        </TabsContent>

        <TabsContent value="mine" className="mt-4">
          {loading ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">{total} request(s) you posted</p>
              {items.map((req) => (
                <Card key={req.id} className="cursor-pointer hover:bg-muted/50 transition-colors" onClick={() => setSelectedRequest(req)}>
                  <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-medium">{req.title}</p>
                      <p className="text-sm text-muted-foreground">{req.serviceType || 'General'} · {req.status}</p>
                    </div>
                    <Badge variant={req.status === 'open' ? 'default' : 'secondary'}>{req.status}</Badge>
                  </CardContent>
                </Card>
              ))}
              {items.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  You haven&apos;t posted any requests. Create one from your artist Services page.
                </p>
              )}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!selectedRequest} onOpenChange={(open) => !open && setSelectedRequest(null)}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          {loadingDetail ? (
            <div className="py-8 text-center text-muted-foreground">Loading...</div>
          ) : requestDetail ? (
            <>
              <DialogHeader>
                <DialogTitle>{requestDetail.title}</DialogTitle>
                <DialogDescription>
                  by <Link href={`/artist/${requestDetail.artistId}`} className="text-primary underline">{requestDetail.artistDisplayName || 'Artist'}</Link>
                  {requestDetail.serviceType && <> · {requestDetail.serviceType}</>}
                  <Badge variant="secondary" className="ml-2">{requestDetail.status}</Badge>
                </DialogDescription>
              </DialogHeader>
              {requestDetail.description && (
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">{requestDetail.description}</p>
              )}

              {isOwner ? (
                <div className="space-y-2">
                  <h3 className="font-medium text-sm">Applications ({applications.length})</h3>
                  {applications.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No applications yet.</p>
                  ) : (
                    <ul className="space-y-2">
                      {applications.map((app) => (
                        <li key={app.id} className="rounded-lg border p-3 text-sm">
                          <p className="font-medium">{app.applicantDisplayName || 'Someone'}</p>
                          {app.message && <p className="text-muted-foreground mt-1">{app.message}</p>}
                          <p className="text-xs text-muted-foreground mt-1">{new Date(app.createdAt).toLocaleString()}</p>
                          <Badge variant="outline" className="mt-1">{app.status}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : (
                <>
                  {requestDetail.status === 'open' && (
                    <Button onClick={() => setApplyOpen(true)} className="w-full mt-2">
                      Apply to this request
                    </Button>
                  )}
                </>
              )}

              <DialogFooter>
                <Button variant="outline" asChild>
                  <Link href={`/artist/${requestDetail.artistId}`}>View artist profile</Link>
                </Button>
                <Button variant="ghost" onClick={() => setSelectedRequest(null)}>Close</Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={applyOpen} onOpenChange={setApplyOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Apply to &quot;{selectedRequest?.title}&quot;</DialogTitle>
            <DialogDescription>Add a short message to introduce yourself (optional).</DialogDescription>
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
            <Button variant="outline" onClick={() => setApplyOpen(false)}>Cancel</Button>
            <Button onClick={handleApply} disabled={applying}>
              {applying ? 'Sending...' : 'Submit application'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {applySuccess && (
        <p className="text-sm text-green-600 text-center">Application submitted. The artist will see it in their &quot;My requests&quot; tab.</p>
      )}
    </div>
  );
}
