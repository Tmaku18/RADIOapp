'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { proNetworxApi, serviceProvidersApi, usersApi, type ExperienceItem, type EducationItem, type FeaturedItem, type ProNetworxMeProfile } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';

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

const emptyExperience = (): ExperienceItem => ({
  title: '',
  company: '',
  location: '',
  startDate: '',
  endDate: '',
  current: false,
  description: '',
});

const emptyEducation = (): EducationItem => ({
  school: '',
  degree: '',
  field: '',
  startYear: '',
  endYear: '',
  description: '',
});

const emptyFeatured = (): FeaturedItem => ({
  type: 'link',
  url: '',
  title: '',
  description: '',
});

const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_AVATAR_SIZE = 15 * 1024 * 1024; // 15MB
const MAX_COVER_SIZE = 15 * 1024 * 1024;   // 15MB

export default function ProNetworxOnboardingPage() {
  const router = useRouter();
  const { user, profile, loading, refreshProfile } = useAuth();
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const [me, setMe] = useState<ProNetworxMeProfile | null>(null);
  const [loadingMe, setLoadingMe] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [availableForWork, setAvailableForWork] = useState(true);
  const [currentTitle, setCurrentTitle] = useState('');
  const [skillsHeadline, setSkillsHeadline] = useState('');
  const [about, setAbout] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');
  const [skillQuery, setSkillQuery] = useState('');
  const [skills, setSkills] = useState<string[]>([]);
  const [experience, setExperience] = useState<ExperienceItem[]>([emptyExperience()]);
  const [education, setEducation] = useState<EducationItem[]>([emptyEducation()]);
  const [featured, setFeatured] = useState<FeaturedItem[]>([emptyFeatured()]);

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
      const data = res.data as ProNetworxMeProfile;
      setMe(data);
      setAvailableForWork(data.availableForWork ?? true);
      setCurrentTitle(data.currentTitle ?? '');
      setSkillsHeadline(data.skillsHeadline ?? '');
      setAbout(data.about ?? '');
      setWebsiteUrl(data.websiteUrl ?? '');
      setSkills((data.skills ?? []).map((s) => s.name).filter(Boolean));
      setExperience(
        (data.experience ?? []).length > 0
          ? data.experience.map((e) => ({ ...emptyExperience(), ...e }))
          : [emptyExperience()],
      );
      setEducation(
        (data.education ?? []).length > 0
          ? data.education.map((e) => ({ ...emptyEducation(), ...e }))
          : [emptyEducation()],
      );
      setFeatured(
        (data.featured ?? []).length > 0
          ? data.featured.map((f) => ({ ...emptyFeatured(), ...f }))
          : [emptyFeatured()],
      );
    } catch {
      setMe(null);
      setAvailableForWork(true);
      setCurrentTitle('');
      setSkillsHeadline('');
      setAbout('');
      setWebsiteUrl('');
      setSkills([]);
      setExperience([emptyExperience()]);
      setEducation([emptyEducation()]);
      setFeatured([emptyFeatured()]);
    } finally {
      setLoadingMe(false);
    }
  };

  useEffect(() => {
    if (!loading && user) loadMe();
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

  const updateExperience = (index: number, patch: Partial<ExperienceItem>) => {
    setExperience((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const addExperience = () => {
    setExperience((prev) => [...prev, emptyExperience()]);
  };

  const removeExperience = (index: number) => {
    setExperience((prev) => (prev.length <= 1 ? [emptyExperience()] : prev.filter((_, i) => i !== index)));
  };

  const updateEducation = (index: number, patch: Partial<EducationItem>) => {
    setEducation((prev) => prev.map((e, i) => (i === index ? { ...e, ...patch } : e)));
  };

  const addEducation = () => {
    setEducation((prev) => [...prev, emptyEducation()]);
  };

  const removeEducation = (index: number) => {
    setEducation((prev) => (prev.length <= 1 ? [emptyEducation()] : prev.filter((_, i) => i !== index)));
  };

  const updateFeatured = (index: number, patch: Partial<FeaturedItem>) => {
    setFeatured((prev) => prev.map((f, i) => (i === index ? { ...f, ...patch } : f)));
  };

  const addFeatured = () => {
    setFeatured((prev) => [...prev, emptyFeatured()]);
  };

  const removeFeatured = (index: number) => {
    setFeatured((prev) => (prev.length <= 1 ? [emptyFeatured()] : prev.filter((_, i) => i !== index)));
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_AVATAR_SIZE) {
      setError('Profile photo must be 15MB or smaller.');
      return;
    }
    setError(null);
    setUploadingAvatar(true);
    try {
      await usersApi.uploadProfilePhoto(file);
      await refreshProfile();
      await loadMe();
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to upload profile photo');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const handleCoverUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      setError('Use JPEG, PNG, or WebP.');
      return;
    }
    if (file.size > MAX_COVER_SIZE) {
      setError('Cover image must be 15MB or smaller.');
      return;
    }
    setError(null);
    setUploadingCover(true);
    try {
      await serviceProvidersApi.uploadCover(file);
      await loadMe();
    } catch (err) {
      setError((err as Error)?.message ?? 'Failed to upload cover photo');
    } finally {
      setUploadingCover(false);
    }
  };

  const sanitizeExperience = (list: ExperienceItem[]): ExperienceItem[] =>
    list
      .filter((e) => e.title.trim() || e.company.trim())
      .map((e) => ({
        title: e.title.trim(),
        company: e.company.trim(),
        location: e.location?.trim() || undefined,
        startDate: e.startDate?.trim() || undefined,
        endDate: e.endDate?.trim() || undefined,
        current: e.current ?? false,
        description: e.description?.trim() || undefined,
      }));

  const sanitizeEducation = (list: EducationItem[]): EducationItem[] =>
    list
      .filter((e) => e.school.trim())
      .map((e) => ({
        school: e.school.trim(),
        degree: e.degree?.trim() || undefined,
        field: e.field?.trim() || undefined,
        startYear: e.startYear?.trim() || undefined,
        endYear: e.endYear?.trim() || undefined,
        description: e.description?.trim() || undefined,
      }));

  const sanitizeFeatured = (list: FeaturedItem[]): FeaturedItem[] =>
    list
      .filter((f) => (f.type === 'link' && f.url?.trim()) || (f.type === 'portfolio' && (f.portfolioItemId || f.url?.trim())))
      .map((f) => ({
        type: f.type,
        url: f.url?.trim() || undefined,
        title: f.title?.trim() || undefined,
        description: f.description?.trim() || undefined,
        portfolioItemId: f.portfolioItemId,
      }));

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      await proNetworxApi.updateMeProfile({
        availableForWork,
        currentTitle: currentTitle.trim() || undefined,
        skillsHeadline: skillsHeadline.trim() || undefined,
        about: about.trim() || undefined,
        websiteUrl: websiteUrl.trim() || undefined,
        experience: sanitizeExperience(experience),
        education: sanitizeEducation(education),
        featured: sanitizeFeatured(featured),
        skillNames: skills,
      });
      router.push('/pro-networx/directory');
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
    <div className="container max-w-3xl py-8 space-y-8">
      <div className="space-y-1 text-center">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Complete your ProNetworx profile</h1>
        <p className="text-muted-foreground">
          Headline, about, experience, education, and skills. Artists and clients discover you here.
        </p>
      </div>

      <Card className="glass-panel border border-border hover:border-primary/20 transition-colors">
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

              {/* Profile photo & cover — set at top for every ProNetworx account */}
              <div className="space-y-4 rounded-lg border border-border bg-muted/20 p-4">
                <h2 className="text-base font-semibold text-foreground">Profile photo & cover</h2>
                <p className="text-sm text-muted-foreground">
                  These appear at the top of your public ProNetworx profile. Cover is your background banner.
                </p>
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">Profile photo</Label>
                    <div className="flex items-center gap-4">
                      <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-full border border-border bg-muted">
                        {(me?.avatarUrl ?? profile?.avatarUrl) ? (
                          <Image
                            src={me?.avatarUrl ?? profile?.avatarUrl ?? ''}
                            alt="Profile"
                            fill
                            className="object-cover"
                          />
                        ) : (
                          <div className="flex h-full w-full items-center justify-center text-2xl text-muted-foreground">👤</div>
                        )}
                      </div>
                      <div>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept={ALLOWED_IMAGE_TYPES.join(',')}
                          className="sr-only"
                          onChange={handleAvatarUpload}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={uploadingAvatar}
                          onClick={() => avatarInputRef.current?.click()}
                        >
                          {uploadingAvatar ? 'Uploading…' : 'Upload photo'}
                        </Button>
                        <p className="text-xs text-muted-foreground mt-1">JPEG, PNG, WebP, max 15MB</p>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm text-foreground">Cover / background</Label>
                    <div className="relative h-24 w-full overflow-hidden rounded-lg border border-border bg-muted">
                      {me?.heroImageUrl ? (
                        <Image
                          src={me.heroImageUrl}
                          alt="Cover"
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-muted-foreground text-sm">No cover yet</div>
                      )}
                    </div>
                    <input
                      ref={coverInputRef}
                      type="file"
                      accept={ALLOWED_IMAGE_TYPES.join(',')}
                      className="sr-only"
                      onChange={handleCoverUpload}
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={uploadingCover}
                      onClick={() => coverInputRef.current?.click()}
                    >
                      {uploadingCover ? 'Uploading…' : 'Upload cover'}
                    </Button>
                    <p className="text-xs text-muted-foreground">JPEG, PNG, WebP, max 15MB</p>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4">
                <div>
                  <Label className="text-base text-foreground">Available for work</Label>
                  <p className="text-sm text-muted-foreground">Artists can filter by who is currently open.</p>
                </div>
                <Switch checked={availableForWork} onCheckedChange={setAvailableForWork} />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Current title / headline</Label>
                <Input
                  value={currentTitle}
                  onChange={(e) => setCurrentTitle(e.target.value)}
                  placeholder="e.g. Producer & Mix Engineer"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Skills headline (optional)</Label>
                <Input
                  value={skillsHeadline}
                  onChange={(e) => setSkillsHeadline(e.target.value)}
                  placeholder="e.g. Producer + Mix Engineer • Atlanta • 48hr turnaround"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">About</Label>
                <Textarea
                  value={about}
                  onChange={(e) => setAbout(e.target.value)}
                  placeholder="Professional summary, what you offer, and who you work with."
                  rows={5}
                  className="bg-background border-border resize-y"
                />
              </div>

              <div className="space-y-2">
                <Label className="text-foreground">Website URL</Label>
                <Input
                  value={websiteUrl}
                  onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder="https://..."
                  type="url"
                  className="bg-background border-border"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <Label className="text-base text-foreground">Skills</Label>
                  <span className="text-xs text-muted-foreground">{skills.length}/50</span>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={skillQuery}
                    onChange={(e) => setSkillQuery(e.target.value)}
                    placeholder="Search or add a skill (e.g. studio, producer)"
                    className="bg-background border-border"
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
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-background border-border hover:bg-muted'
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

              {/* Experience */}
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-base text-foreground">Experience</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addExperience}>
                    Add experience
                  </Button>
                </div>
                {experience.map((exp, index) => (
                  <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Job title"
                        value={exp.title}
                        onChange={(e) => updateExperience(index, { title: e.target.value })}
                        className="bg-background border-border"
                      />
                      <Input
                        placeholder="Company"
                        value={exp.company}
                        onChange={(e) => updateExperience(index, { company: e.target.value })}
                        className="bg-background border-border"
                      />
                    </div>
                    <Input
                      placeholder="Location (optional)"
                      value={exp.location ?? ''}
                      onChange={(e) => updateExperience(index, { location: e.target.value })}
                      className="bg-background border-border"
                    />
                    <div className="flex gap-2 items-center flex-wrap">
                      <Input
                        placeholder="Start date"
                        value={exp.startDate ?? ''}
                        onChange={(e) => updateExperience(index, { startDate: e.target.value })}
                        className="bg-background border-border max-w-[140px]"
                      />
                      <Input
                        placeholder="End date"
                        value={exp.endDate ?? ''}
                        onChange={(e) => updateExperience(index, { endDate: e.target.value })}
                        className="bg-background border-border max-w-[140px]"
                      />
                      <label className="flex items-center gap-2 text-sm">
                        <input
                          type="checkbox"
                          checked={exp.current ?? false}
                          onChange={(e) => updateExperience(index, { current: e.target.checked })}
                          className="rounded border-border"
                        />
                        Current
                      </label>
                    </div>
                    <Textarea
                      placeholder="Description (optional)"
                      value={exp.description ?? ''}
                      onChange={(e) => updateExperience(index, { description: e.target.value })}
                      rows={2}
                      className="bg-background border-border resize-y"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeExperience(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {/* Education */}
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-base text-foreground">Education</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addEducation}>
                    Add education
                  </Button>
                </div>
                {education.map((edu, index) => (
                  <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                    <Input
                      placeholder="School"
                      value={edu.school}
                      onChange={(e) => updateEducation(index, { school: e.target.value })}
                      className="bg-background border-border"
                    />
                    <div className="grid gap-2 sm:grid-cols-2">
                      <Input
                        placeholder="Degree (optional)"
                        value={edu.degree ?? ''}
                        onChange={(e) => updateEducation(index, { degree: e.target.value })}
                        className="bg-background border-border"
                      />
                      <Input
                        placeholder="Field of study (optional)"
                        value={edu.field ?? ''}
                        onChange={(e) => updateEducation(index, { field: e.target.value })}
                        className="bg-background border-border"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Input
                        placeholder="Start year"
                        value={edu.startYear ?? ''}
                        onChange={(e) => updateEducation(index, { startYear: e.target.value })}
                        className="bg-background border-border max-w-[100px]"
                      />
                      <Input
                        placeholder="End year"
                        value={edu.endYear ?? ''}
                        onChange={(e) => updateEducation(index, { endYear: e.target.value })}
                        className="bg-background border-border max-w-[100px]"
                      />
                    </div>
                    <Textarea
                      placeholder="Description (optional)"
                      value={edu.description ?? ''}
                      onChange={(e) => updateEducation(index, { description: e.target.value })}
                      rows={2}
                      className="bg-background border-border resize-y"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeEducation(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {/* Featured links */}
              <div className="space-y-3 border-t border-border pt-6">
                <div className="flex items-center justify-between">
                  <Label className="text-base text-foreground">Featured links</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addFeatured}>
                    Add link
                  </Button>
                </div>
                {featured.map((f, index) => (
                  <div key={index} className="rounded-lg border border-border p-4 space-y-3">
                    <Input
                      placeholder="Title"
                      value={f.title ?? ''}
                      onChange={(e) => updateFeatured(index, { title: e.target.value })}
                      className="bg-background border-border"
                    />
                    <Input
                      placeholder="URL"
                      value={f.url ?? ''}
                      onChange={(e) => updateFeatured(index, { url: e.target.value })}
                      type="url"
                      className="bg-background border-border"
                    />
                    <Textarea
                      placeholder="Short description (optional)"
                      value={f.description ?? ''}
                      onChange={(e) => updateFeatured(index, { description: e.target.value })}
                      rows={2}
                      className="bg-background border-border resize-y"
                    />
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeFeatured(index)}>
                      Remove
                    </Button>
                  </div>
                ))}
              </div>

              {error && <p className="text-sm text-destructive">{error}</p>}

              <div className="flex items-center justify-between gap-3 flex-wrap pt-4">
                <Button variant="outline" onClick={() => router.push('/pro-networx/directory')}>
                  Skip for now
                </Button>
                <Button onClick={save} disabled={saving} className="bg-primary text-primary-foreground hover:opacity-90">
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
