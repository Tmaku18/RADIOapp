import {
  nameCompact,
  numberedCopyStem,
  usernameFromDisplayName,
} from './username.util';

describe('name identity helpers', () => {
  it('treats spacing and punctuation as the same name', () => {
    expect(nameCompact('DJ Nova')).toBe('djnova');
    expect(nameCompact('dj_nova')).toBe('djnova');
  });

  it('flags a numbered copy of a taken name', () => {
    expect(numberedCopyStem('alex2')).toBe('alex');
    expect(numberedCopyStem('djnova12')).toBe('djnova');
    expect(numberedCopyStem('djnova')).toBeNull();
    expect(numberedCopyStem('ab2')).toBeNull();
  });

  it('builds a username from the display name without adding a suffix', () => {
    expect(usernameFromDisplayName('DJ Nova')).toBe('djnova');
    expect(usernameFromDisplayName('Al')).toBeNull();
  });
});
