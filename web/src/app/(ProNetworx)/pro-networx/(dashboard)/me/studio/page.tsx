'use client';

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { studiosApi, type Studio, type StudioHour, type StudioMember, type StudioRateUnit } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { hasArtistCapability } from '@/lib/roles';

const AMENITIES = [
  'Live room',
  'Vocal booth',
  'Isolation booth',
  'Mixing desk',
  'Monitor speakers',
  'Piano',
  'Drums',
  'Guitar amps',
  'Engineer included',
  'Parking',
  'Wi-Fi',
  'ADA accessible',
];

type RateDraft = { label: string; dollars: string; unit: StudioRateUnit };

const EMPTY_RATE: RateDraft = { label: 'Studio time', dollars: '', unit: 'hour' };
const WEEK_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function defaultHours(existing?: StudioHour[]): StudioHour[] {
  return WEEK_DAYS.map((day) => {
    const found = existing?.find((h) => h.day === day);
    return found ?? { day, open: '10:00', close: '22:00', closed: true };
  });
}

export default function MyStudioPage() {
  const { profile, loading: authLoading } = useAuth();
  const allowed =
    !!profile &&
    (hasArtistCapability(profile.role) ||
      profile.role === 'service_provider' ||
      profile.role === 'admin');

  const [items, setItems] = useState<Studio[]>([]);
  const [editing, setEditing] = useState<Studio | null>(null);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const res = await studiosApi.listMine();
      setItems(res.data.items);
    } catch (e) {
      console.error(e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!allowed) return;
    void refresh();
  }, [allowed, refresh]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-primary" />
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-sm text-muted-foreground">
        Studio pages are available to artists and producers.
      </div>
    );
  }

  if (creating || editing) {
    return (
      <StudioForm
        existing={editing}
        onCancel={() => {
          setCreating(false);
          setEditing(null);
        }}
        onSaved={async () => {
          setCreating(false);
          setEditing(null);
          await refresh();
        }}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My studio</h1>
          <p className="text-sm text-muted-foreground">
            Publish a rate card and choose whether the map pin is exact or approximate.
          </p>
        </div>
        <Button onClick={() => setCreating(true)}>Add studio</Button>
      </div>
      {items.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No studio page yet.
        </Card>
      ) : (
        <div className="space-y-3">
          {items.map((s) => (
            <Card key={s.id} className="p-4 flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold">{s.name}</div>
                <div className="text-xs text-muted-foreground">
                  {s.isPublished ? 'Published' : 'Hidden'} ·{' '}
                  {s.locationPrecision === 'exact' ? 'Exact pin' : 'Approximate area'}
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" asChild>
                  <Link href={`/pro-networx/studios/${s.id}`}>View</Link>
                </Button>
                <Button variant="outline" onClick={() => setEditing(s)}>
                  Edit
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

function StudioForm({
  existing,
  onCancel,
  onSaved,
}: {
  existing: Studio | null;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}) {
  const [name, setName] = useState(existing?.name ?? '');
  const [tagline, setTagline] = useState(existing?.tagline ?? '');
  const [about, setAbout] = useState(existing?.about ?? '');
  const [heroImageUrl, setHeroImageUrl] = useState(existing?.heroImageUrl ?? '');
  const [photos, setPhotos] = useState((existing?.photos ?? []).join('\n'));
  const [hours, setHours] = useState<StudioHour[]>(defaultHours(existing?.hours));
  const [members, setMembers] = useState<StudioMember[]>(existing?.members ?? []);
  const [memberQuery, setMemberQuery] = useState('');
  const [memberHits, setMemberHits] = useState<StudioMember[]>([]);
  const [addressLine1, setAddressLine1] = useState(existing?.addressLine1 ?? '');
  const [city, setCity] = useState(existing?.city ?? '');
  const [state, setState] = useState(existing?.state ?? '');
  const [zipCode, setZipCode] = useState(existing?.zipCode ?? '');
  const [exact, setExact] = useState(existing?.locationPrecision === 'exact');
  const [published, setPublished] = useState(existing?.isPublished ?? true);
  const [bookingLink, setBookingLink] = useState(existing?.bookingLink ?? '');
  const [contactEmail, setContactEmail] = useState(existing?.contactEmail ?? '');
  const [contactPhone, setContactPhone] = useState(existing?.contactPhone ?? '');
  const [amenities, setAmenities] = useState<string[]>(existing?.amenities ?? []);
  const [rates, setRates] = useState<RateDraft[]>(
    existing?.rates.length
      ? existing.rates.map((r) => ({
          label: r.label,
          dollars: (r.priceCents / 100).toFixed(2),
          unit: r.unit,
        }))
      : [EMPTY_RATE],
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!name.trim()) {
      setError('Name is required');
      return;
    }
    setSaving(true);
    setError(null);
    const payload = {
      name: name.trim(),
      tagline: tagline.trim(),
      about: about.trim(),
      heroImageUrl: heroImageUrl.trim(),
      photos: photos.split(/[\n,]/).map((s) => s.trim()).filter(Boolean),
      hours,
      members: members.map((m) => ({ userId: m.userId, title: m.title ?? undefined })),
      addressLine1: addressLine1.trim(),
      city: city.trim(),
      state: state.trim(),
      zipCode: zipCode.trim(),
      locationPrecision: exact ? 'exact' : 'approximate',
      isPublished: published,
      bookingLink: bookingLink.trim(),
      contactEmail: contactEmail.trim(),
      contactPhone: contactPhone.trim(),
      amenities,
      rates: rates
        .map((r) => ({
          label: r.label.trim(),
          priceCents: Math.round(Number(r.dollars) * 100),
          unit: r.unit,
        }))
        .filter((r) => r.label && Number.isFinite(r.priceCents) && r.priceCents >= 0),
    } as const;
    try {
      if (existing) await studiosApi.update(existing.id, payload);
      else await studiosApi.create(payload);
      await onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 space-y-5">
      <h1 className="text-2xl font-semibold">
        {existing ? 'Edit studio' : 'New studio'}
      </h1>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="grid gap-3">
        <Field label="Studio name">
          <Input value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        <Field label="Tagline">
          <Input value={tagline} onChange={(e) => setTagline(e.target.value)} />
        </Field>
        <Field label="About">
          <Textarea value={about} onChange={(e) => setAbout(e.target.value)} rows={4} />
        </Field>
        <Field label="Banner image URL">
          <Input value={heroImageUrl} onChange={(e) => setHeroImageUrl(e.target.value)} />
        </Field>
        <Field label="Studio photos (one image URL per line)">
          <Textarea value={photos} onChange={(e) => setPhotos(e.target.value)} rows={3} />
        </Field>
        <div className="space-y-2">
          <Label>Hours</Label>
          {hours.map((h, i) => (
            <div key={h.day} className="grid grid-cols-[48px_1fr_1fr_auto] gap-2 items-center">
              <span className="text-sm">{h.day}</span>
              <Input
                disabled={h.closed}
                value={h.open ?? ''}
                onChange={(e) =>
                  setHours((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, open: e.target.value } : x)),
                  )
                }
              />
              <Input
                disabled={h.closed}
                value={h.close ?? ''}
                onChange={(e) =>
                  setHours((prev) =>
                    prev.map((x, idx) => (idx === i ? { ...x, close: e.target.value } : x)),
                  )
                }
              />
              <label className="text-xs flex items-center gap-1">
                <input
                  type="checkbox"
                  checked={h.closed}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((x, idx) => (idx === i ? { ...x, closed: e.target.checked } : x)),
                    )
                  }
                />
                Closed
              </label>
            </div>
          ))}
        </div>
        <div className="space-y-2">
          <Label>Bookable producers &amp; artists</Label>
          <Input
            value={memberQuery}
            placeholder="Search people on Networx"
            onChange={async (e) => {
              const q = e.target.value;
              setMemberQuery(q);
              if (q.trim().length < 2) {
                setMemberHits([]);
                return;
              }
              try {
                const res = await studiosApi.searchPeople(q.trim());
                setMemberHits(res.data.items);
              } catch {
                setMemberHits([]);
              }
            }}
          />
          {memberHits.map((hit) => (
            <div key={hit.userId} className="flex items-center justify-between text-sm">
              <span>{hit.displayName || 'Creator'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  if (members.some((m) => m.userId === hit.userId)) return;
                  setMembers((prev) => [...prev, hit]);
                }}
              >
                Add
              </Button>
            </div>
          ))}
          {members.map((m) => (
            <div key={m.userId} className="flex items-center justify-between text-sm">
              <span>{m.displayName || 'Creator'}</span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setMembers((prev) => prev.filter((x) => x.userId !== m.userId))}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={exact}
            onChange={(e) => setExact(e.target.checked)}
          />
          Show exact street address on the map
        </label>
        {exact && (
          <Field label="Street address">
            <Input value={addressLine1} onChange={(e) => setAddressLine1(e.target.value)} />
          </Field>
        )}
        <div className="grid grid-cols-3 gap-2">
          <Field label="City">
            <Input value={city} onChange={(e) => setCity(e.target.value)} />
          </Field>
          <Field label="State">
            <Input value={state} onChange={(e) => setState(e.target.value)} />
          </Field>
          <Field label="ZIP">
            <Input value={zipCode} onChange={(e) => setZipCode(e.target.value)} />
          </Field>
        </div>
        <div>
          <Label>Amenities</Label>
          <div className="flex flex-wrap gap-2 mt-2">
            {AMENITIES.map((a) => {
              const on = amenities.includes(a);
              return (
                <button
                  key={a}
                  type="button"
                  onClick={() =>
                    setAmenities((prev) =>
                      on ? prev.filter((x) => x !== a) : [...prev, a],
                    )
                  }
                  className={`text-xs px-2 py-1 rounded-full border ${
                    on
                      ? 'bg-cyan-400 text-black border-cyan-400'
                      : 'border-border text-muted-foreground'
                  }`}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Rates</Label>
            <Button
              type="button"
              variant="ghost"
              onClick={() =>
                setRates((prev) => [...prev, { label: '', dollars: '', unit: 'hour' }])
              }
            >
              Add rate
            </Button>
          </div>
          {rates.map((r, i) => (
            <div key={i} className="grid grid-cols-[1fr_100px_140px_auto] gap-2">
              <Input
                placeholder="Label"
                value={r.label}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, label: e.target.value } : x,
                    ),
                  )
                }
              />
              <Input
                placeholder="$"
                value={r.dollars}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((x, idx) =>
                      idx === i ? { ...x, dollars: e.target.value } : x,
                    ),
                  )
                }
              />
              <select
                className="h-9 rounded-md border border-input bg-background px-2 text-sm"
                value={r.unit}
                onChange={(e) =>
                  setRates((prev) =>
                    prev.map((x, idx) =>
                      idx === i
                        ? { ...x, unit: e.target.value as StudioRateUnit }
                        : x,
                    ),
                  )
                }
              >
                <option value="hour">Hour</option>
                <option value="day">Day</option>
                <option value="half_day">Half day</option>
                <option value="session">Session</option>
              </select>
              <Button
                type="button"
                variant="ghost"
                disabled={rates.length === 1}
                onClick={() => setRates((prev) => prev.filter((_, idx) => idx !== i))}
              >
                ×
              </Button>
            </div>
          ))}
        </div>
        <Field label="Booking link">
          <Input value={bookingLink} onChange={(e) => setBookingLink(e.target.value)} />
        </Field>
        <Field label="Contact email">
          <Input value={contactEmail} onChange={(e) => setContactEmail(e.target.value)} />
        </Field>
        <Field label="Contact phone">
          <Input value={contactPhone} onChange={(e) => setContactPhone(e.target.value)} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={published}
            onChange={(e) => setPublished(e.target.checked)}
          />
          Published on the map
        </label>
      </div>
      <div className="flex gap-2">
        <Button onClick={() => void save()} disabled={saving}>
          {saving ? 'Saving…' : 'Save studio'}
        </Button>
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
