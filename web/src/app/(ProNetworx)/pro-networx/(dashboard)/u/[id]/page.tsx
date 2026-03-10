'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Image from 'next/image';
import { proNetworxApi, type ExperienceItem, type EducationItem, type FeaturedItem } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

type ProviderListing = {
  id: string;
  serviceType: string;
  title: string;
  description: string | null;
  rateCents: number | null;
  rateType: 'hourly' | 'fixed';
  status: 'active' | 'paused';
  createdAt: string;
  updatedAt: string;
};

type PortfolioItem = {
  id: string;
  type: 'image' | 'audio' | 'video';
  fileUrl: string;
  title: string | null;
  description: string | null;
  sortOrder: number;
  createdAt: string;
};

type ProPublicProfile = {
  userId: string;
  role: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  headline: string | null;
  currentTitle?: string | null;
  bio?: string | null;
  about?: string | null;
  locationRegion: string | null;
  websiteUrl?: string | null;
  availableForWork: boolean;
  skillsHeadline: string | null;
  skills: string[];
  serviceTitle?: string | null;
  mediaPreviewUrl?: string | null;
  mediaPreviewType?: 'image' | 'video' | 'audio' | null;
  startingAtCents?: number | null;
  startingAtRateType?: 'hourly' | 'fixed' | null;
  verifiedCatalyst?: boolean;
  mentorOptIn?: boolean;
  updatedAt: string | null;
  experience?: ExperienceItem[];
  education?: EducationItem[];
  featured?: FeaturedItem[];
  listings?: ProviderListing[];
  portfolio?: PortfolioItem[];
};

function formatRate(rateCents: number | null, rateType: 'hourly' | 'fixed'): string {
  if (rateCents == null) return 'Contact for pricing';
  const dollars = (rateCents / 100).toFixed(2);
  return rateType === 'hourly' ? `$${dollars}/hr` : `$${dollars}`;
}

export default function ProNetworxProfilePage() {
  const params = useParams();
  const id = params.id as string;

  const [data, setData] = useState<ProPublicProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    proNetworxApi.getProfileByUserId(id).then((res) => {
      if (!alive) return;
      setData(res.data as ProPublicProfile);
    }).catch((e) => {
      console.error('Failed to load profile:', e);
      if (alive) setData(null);
    }).finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [id]);

  const activeListings = useMemo(() => (data?.listings ?? []).filter((l) => l.status === 'active'), [data?.listings]);
  const experience = (data?.experience ?? []).filter((e) => e.title?.trim() || e.company?.trim());
  const education = (data?.education ?? []).filter((e) => e.school?.trim());
  const featured = (data?.featured ?? []).filter((f) => f.url?.trim() || f.title?.trim());
  const aboutText = (data?.about ?? data?.bio ?? '').trim();
  const headlineText = data?.currentTitle ?? data?.skillsHeadline ?? data?.headline ?? '—';

  return (
    <div className="container max-w-6xl py-6 sm:py-8">
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
        </div>
      ) : !data ? (
        <Card className="glass-panel border border-border">
          <CardContent className="pt-10 pb-10 text-center text-muted-foreground">
            Profile not found.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Hero / top profile card (LinkedIn-style) */}
          <Card className="glass-panel border border-border overflow-hidden mb-6">
            <div className="relative w-full h-32 sm:h-40 bg-muted/50">
              {data.mediaPreviewUrl && data.mediaPreviewType === 'image' && (
                <Image
                  src={data.mediaPreviewUrl}
                  alt=""
                  fill
                  className="object-cover opacity-80"
                />
              )}
              <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
            </div>
            <CardContent className="relative px-4 sm:px-6 pb-6 -mt-16 sm:-mt-20">
              <div className="flex flex-col sm:flex-row sm:items-end gap-4">
                <div className="flex items-end gap-4">
                  {data.avatarUrl ? (
                    <Image
                      src={data.avatarUrl}
                      alt={data.displayName ?? 'Avatar'}
                      width={128}
                      height={128}
                      className="rounded-full object-cover border-4 border-background shadow-lg size-24 sm:size-32 shrink-0"
                    />
                  ) : (
                    <div className="size-24 sm:size-32 rounded-full bg-muted border-4 border-background flex items-center justify-center text-4xl shrink-0">
                      ✦
                    </div>
                  )}
                  <div className="pb-1 min-w-0">
                    <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                      {data.displayName || 'Unnamed'}
                    </h1>
                    <p className="text-muted-foreground mt-0.5">
                      {headlineText}
                    </p>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 text-sm text-muted-foreground">
                      {data.locationRegion && <span>📍 {data.locationRegion}</span>}
                      {data.websiteUrl && (
                        <a href={data.websiteUrl} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline truncate max-w-[200px]">
                          Contact info
                        </a>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-2 mt-3">
                      {data.verifiedCatalyst && (
                        <Badge className="bg-[color:var(--brand-verified)] text-primary-foreground border-0">Verified Catalyst</Badge>
                      )}
                      {data.availableForWork && (
                        <Badge variant="secondary">Open to work</Badge>
                      )}
                      {data.mentorOptIn && (
                        <Badge variant="outline" className="border-primary/30">Mentor</Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="hidden sm:flex gap-2 shrink-0 ml-auto">
                  <Button asChild className="bg-primary text-primary-foreground hover:opacity-90">
                    <Link href={`/messages?with=${data.userId}`}>Message</Link>
                  </Button>
                  <Button variant="outline" asChild>
                    <Link href="/pro-networx/directory">Back to directory</Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
            {/* Main column: About, Featured, Experience, Education, Portfolio */}
            <div className="space-y-6">
              {aboutText && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-3">
                    <h2 className="text-lg font-semibold text-foreground">About</h2>
                    <p className="text-muted-foreground whitespace-pre-wrap">{aboutText}</p>
                  </CardContent>
                </Card>
              )}

              {data.skills.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-3">
                    <h2 className="text-lg font-semibold text-foreground">Skills</h2>
                    <div className="flex flex-wrap gap-2">
                      {data.skills.map((s) => (
                        <Badge key={s} variant="secondary" className="font-normal">
                          {s.replace(/_/g, ' ')}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {featured.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-4">
                    <h2 className="text-lg font-semibold text-foreground">Featured</h2>
                    <ul className="space-y-3">
                      {featured.map((f, i) => (
                        <li key={i}>
                          {f.url ? (
                            <a
                              href={f.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-primary hover:underline font-medium"
                            >
                              {f.title || f.url}
                            </a>
                          ) : (
                            <span className="font-medium text-foreground">{f.title}</span>
                          )}
                          {f.description && (
                            <p className="text-sm text-muted-foreground mt-0.5">{f.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {experience.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-5">
                    <h2 className="text-lg font-semibold text-foreground">Experience</h2>
                    <ul className="space-y-5">
                      {experience.map((exp, i) => (
                        <li key={i} className="border-b border-border last:border-0 last:pb-0 pb-5 last:pb-0">
                          <div className="font-semibold text-foreground">{exp.title}</div>
                          <div className="text-sm text-muted-foreground">
                            {exp.company}
                            {exp.location && ` · ${exp.location}`}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {exp.startDate}
                            {exp.endDate || exp.current ? ` – ${exp.current ? 'Present' : exp.endDate}` : ''}
                          </div>
                          {exp.description && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{exp.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              {education.length > 0 && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6 space-y-5">
                    <h2 className="text-lg font-semibold text-foreground">Education</h2>
                    <ul className="space-y-5">
                      {education.map((edu, i) => (
                        <li key={i} className="border-b border-border last:border-0 last:pb-0 pb-5 last:pb-0">
                          <div className="font-semibold text-foreground">{edu.school}</div>
                          <div className="text-sm text-muted-foreground">
                            {[edu.degree, edu.field].filter(Boolean).join(' · ')}
                          </div>
                          <div className="text-xs text-muted-foreground mt-0.5">
                            {edu.startYear}
                            {edu.endYear ? ` – ${edu.endYear}` : ''}
                          </div>
                          {edu.description && (
                            <p className="text-sm text-muted-foreground mt-2 whitespace-pre-wrap">{edu.description}</p>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <Card className="glass-panel border border-border">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h2 className="text-lg font-semibold text-foreground">Portfolio</h2>
                    <span className="text-xs text-muted-foreground">{(data.portfolio ?? []).length} items</span>
                  </div>
                  {(data.portfolio ?? []).length === 0 ? (
                    <p className="text-muted-foreground text-sm">No portfolio items yet.</p>
                  ) : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(data.portfolio ?? []).slice(0, 6).map((p) => (
                        <Card key={p.id} className="overflow-hidden border border-border bg-card">
                          <CardContent className="p-0">
                            {p.type === 'image' && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.fileUrl} alt={p.title ?? 'Portfolio'} className="w-full h-36 object-cover" />
                            )}
                            {p.type === 'video' && (
                              <div className="w-full aspect-video bg-muted">
                                <video src={p.fileUrl} controls className="w-full h-full object-contain" title={p.title ?? 'Video'} />
                              </div>
                            )}
                            {p.type === 'audio' && <audio controls src={p.fileUrl} className="w-full" />}
                            <div className="p-3 space-y-1">
                              {p.title && <p className="font-medium text-foreground text-sm">{p.title}</p>}
                              {p.description && <p className="text-xs text-muted-foreground line-clamp-2">{p.description}</p>}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Side rail: Services, Contact / links */}
            <div className="space-y-6">
              <Card className="glass-panel border border-border sticky top-4">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center justify-between gap-2">
                    <h2 className="text-lg font-semibold text-foreground">Services</h2>
                    <Badge variant="outline" className="border-primary/30 shrink-0">{activeListings.length} active</Badge>
                  </div>
                  {activeListings.length === 0 ? (
                    <p className="text-muted-foreground text-sm">No active listings yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {activeListings.map((l) => (
                        <div key={l.id} className="rounded-lg border border-border p-3 space-y-2">
                          <div className="flex justify-between gap-2">
                            <p className="font-medium text-foreground text-sm truncate">{l.title}</p>
                            <span className="text-xs font-mono text-foreground shrink-0">{formatRate(l.rateCents, l.rateType)}</span>
                          </div>
                          <p className="text-xs text-muted-foreground capitalize">{l.serviceType.replace(/_/g, ' ')}</p>
                          {l.description && (
                            <p className="text-xs text-muted-foreground line-clamp-2">{l.description}</p>
                          )}
                          <Button asChild size="sm" className="w-full bg-primary text-primary-foreground hover:opacity-90">
                            <Link href={`/messages?with=${data.userId}`}>Message</Link>
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="pt-4 border-t border-border space-y-2">
                    <p className="text-sm text-muted-foreground">
                      {data.startingAtCents != null
                        ? `Starting at $${(data.startingAtCents / 100).toFixed(2)}${data.startingAtRateType === 'hourly' ? '/hr' : ''}`
                        : 'Contact for pricing'}
                    </p>
                    <Button asChild className="w-full bg-primary text-primary-foreground hover:opacity-90">
                      <Link href={`/messages?with=${data.userId}`}>Message</Link>
                    </Button>
                    <Button variant="outline" asChild className="w-full">
                      <Link href="/pro-networx/directory">Back to directory</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {data.websiteUrl && (
                <Card className="glass-panel border border-border">
                  <CardContent className="pt-6">
                    <h2 className="text-lg font-semibold text-foreground mb-3">Contact</h2>
                    <a
                      href={data.websiteUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-primary hover:underline text-sm break-all"
                    >
                      {data.websiteUrl}
                    </a>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>

          <div className="mt-6 flex sm:hidden gap-2">
            <Button asChild className="flex-1 bg-primary text-primary-foreground hover:opacity-90">
              <Link href={`/messages?with=${data.userId}`}>Message</Link>
            </Button>
            <Button variant="outline" asChild className="flex-1">
              <Link href="/pro-networx/directory">Back to directory</Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
