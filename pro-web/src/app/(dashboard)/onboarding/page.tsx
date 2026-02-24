'use client';

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { proNetworxApi } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

type ProMeProfile = {
  userId: string;
  availableForWork: boolean;
  skillsHeadline: string | null;
  skills: Array<{ name: string; category: string }>;
};

const DEFAULT_SKILLS = [
  'artist',
  'producer',
  'studio',
  'mixing',
  'mastering',
  'graphic_designer',
  'photographer',
  'videographer',
  'social_media_manager',
  'manager',
  'booking',
];

export default function OnboardingPage() {
  const router = useRouter();
  const { user, profile, loading } = useAuth();

  const [me, setMe] = useState<ProMeProfile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableForWork, setAvailableForWork] = useState(true);
  const [skillsHeadline, setSkillsHeadline] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [skills, setSkills] = useState<string[]>([]);

  const suggestedSkills = useMemo(() => {
    const q = skillQuery.trim().toLowerCase();
    const base = DEFAULT_SKILLS;
    if (!q) return base;
    return base.filter((s) => s.includes(q));
  }, [skillQuery]);

  const loadMe = async () => {
    setLoadingMe(true);
    try {
      const res = await proNetworxApi.getMeProfile();
      const data = res.data as ProMeProfile;
      setMe(data);
      setAvailableForWork(data.availableForWork ?? true);
      setSkillsHeadline(data.skillsHeadline ?? '');
      setSkills((data.skills ?? []).map((s) => s.name).filter(Boolean));
    } catch (e) {
      // No profile yet is fine; we will create on save
      setMe(null);
      setAvailableForWork(true);
      setSkillsHeadline('');
      setSkills([]);
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login?redirect=' + encodeURIComponent('/onboarding'));
    }
  }, [loading, user, router]);

  useEffect(() => {
    if (!loading && user) loadMe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user?.uid]);

  const toggleSkill = (name: string) => {
    const normalized = name.trim().toLowerCase();
    if (!normalized) return;
    setSkills((prev) => (prev.includes(normalized) ? prev.filter((s) => s !== normalized) : [...prev, normalized].slice(0, 50)));
  };

  const addCustomSkill = () => {
    const normalized = skillQuery.trim().toLowerCase().replace(/\s+/g, '_');
    if (!normalized) return;
    toggleSkill(normalized);
    setSkillQuery('');
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await proNetworxApi.updateMeProfile({
        availableForWork,
        skillsHeadline: skillsHeadline.trim() || undefined,
        skillNames: skills,
      });
      router.push('/directory');
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? (err instanceof Error ? err.message : 'Failed to save profile');
      setError(msg);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="container max-w-3xl py-8 space-y-6">
      <div className="space-y-1">
        <h1 className="text-3xl font-semibold tracking-tight">Build your PRO-NETWORX profile</h1>
        <p className="text-muted-foreground">
          Strategic minimalism. High signal. Pick what you do and whether you&apos;re open to work.
        </p>
      </div>

      <Card className="glass-panel border border-primary/20">
        <CardContent className="pt-6 space-y-6">
          {loadingMe ? (
            <div className="py-10 text-center text-muted-foreground">Loading…</div>
          ) : (
            <>
              {profile?.displayName && (
                <p className="text-sm text-muted-foreground">
                  Signed in as <span className="text-foreground font-medium">{profile.displayName}</span>
                </p>
              )}

              <div className="flex items-center justify-between rounded-lg border border-border/60 bg-background/30 p-4">
                <div>
                  <Label className="text-base">Available for work</Label>
                  <p className="text-sm text-muted-foreground">Artists can filter by who is currently open.</p>
                </div>
                <Switch checked={availableForWork} onCheckedChange={setAvailableForWork} />
              </div>

              <div className="space-y-2">
                <Label>Skills headline (optional)</Label>
                <Textarea
                  value={skillsHeadline}
                  onChange={(e) => setSkillsHeadline(e.target.value)}
                  placeholder="e.g. Producer + Mix Engineer • Atlanta • 48hr turnaround"
                  className="min-h-[90px]"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Label className="text-base">Skills</Label>
                  <span className="text-xs text-muted-foreground">{skills.length}/50</span>
                </div>

                <div className="flex gap-2">
                  <Input
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder="Search or add a skill (e.g. studio, producer, photographer)"
                  />
                  <Button type="button" variant="secondary" onClick={addCustomSkill} disabled={!skillQuery.trim()}>
                    Add
                  </Button>
                </div>

                <div className="flex flex-wrap gap-2">
                  {suggestedSkills.map((s) => {
                    const selected = skills.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSkill(s)}
                        className={`px-3 py-1 rounded-full text-sm border transition-colors ${
                          selected
                            ? 'bg-primary text-primary-foreground border-primary shadow-[var(--brand-glow)]'
                            : 'bg-background/20 border-border hover:bg-muted/40'
                        }`}
                      >
                        {s.replace(/_/g, ' ')}
                      </button>
                    );
                  })}
                </div>

                {skills.length > 0 && (
                  <div className="flex flex-wrap gap-2 pt-2">
                    {skills.map((s) => (
                      <Badge key={s} variant="outline" className="border-primary/30">
                        {s.replace(/_/g, ' ')}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>

              {error && (
                <p className="text-sm text-destructive">{error}</p>
              )}

              <div className="flex items-center justify-between gap-3 flex-wrap">
                <Button variant="outline" onClick={() => router.push('/dashboard')}>
                  Skip for now
                </Button>
                <Button onClick={save} disabled={saving}>
                  {saving ? 'Saving…' : me ? 'Save and continue' : 'Create profile'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

