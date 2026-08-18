import { LOCATION_VICINITY_RADIUS_KM } from '../common/geocode.util';
import {
  parseDirectoryInclude,
  publishStudioLocation,
  startingAtFromRates,
} from './studio-public.util';

describe('parseDirectoryInclude', () => {
  it('defaults to people and studios', () => {
    expect(parseDirectoryInclude(undefined)).toEqual({
      people: true,
      studios: true,
    });
    expect(parseDirectoryInclude('')).toEqual({ people: true, studios: true });
    expect(parseDirectoryInclude('all')).toEqual({
      people: true,
      studios: true,
    });
  });

  it('parses a single kind', () => {
    expect(parseDirectoryInclude('studios')).toEqual({
      people: false,
      studios: true,
    });
    expect(parseDirectoryInclude('people')).toEqual({
      people: true,
      studios: false,
    });
  });

  it('parses a comma list', () => {
    expect(parseDirectoryInclude('people,studios')).toEqual({
      people: true,
      studios: true,
    });
  });
});

describe('startingAtFromRates', () => {
  it('returns the cheapest priced rate', () => {
    expect(
      startingAtFromRates([
        { price_cents: 15000, unit: 'day' },
        { price_cents: 7500, unit: 'hour' },
        { price_cents: 20000, unit: 'session' },
      ]),
    ).toEqual({ cents: 7500, unit: 'hour' });
  });

  it('skips null prices', () => {
    expect(
      startingAtFromRates([
        { price_cents: null, unit: 'hour' },
        { price_cents: 4000, unit: 'session' },
      ]),
    ).toEqual({ cents: 4000, unit: 'session' });
  });

  it('returns nulls when nothing is priced', () => {
    expect(startingAtFromRates([])).toEqual({ cents: null, unit: null });
  });
});

describe('publishStudioLocation', () => {
  it('publishes the exact point with no vicinity circle', () => {
    const pub = publishStudioLocation(33.749, -84.388, 'studio-1', 'exact');
    expect(pub.vicinityRadiusKm).toBeNull();
    expect(pub.lat).toBeCloseTo(33.749, 4);
    expect(pub.lng).toBeCloseTo(-84.388, 4);
  });

  it('fuzzes approximate studios like people', () => {
    const pub = publishStudioLocation(
      33.749,
      -84.388,
      'studio-approx',
      'approximate',
    );
    expect(pub.vicinityRadiusKm).toBe(LOCATION_VICINITY_RADIUS_KM);
    expect(pub.lat).not.toBeCloseTo(33.749, 3);
  });
});
