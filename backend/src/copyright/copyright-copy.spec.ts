import {
  buildCopyrightRejectionReason,
  copyrightUploaderNoticeBody,
  copyrightUploaderNoticeTitle,
  parseCopyrightMatch,
} from './copyright-copy';

describe('copyright-copy', () => {
  const match = {
    title: 'Blinding Lights',
    artists: ['The Weeknd'],
    album: 'After Hours',
    label: 'XO',
    score: 94.2,
  };

  it('parses a stored match and ignores extra provider fields', () => {
    expect(
      parseCopyrightMatch({
        ...match,
        provider: 'acrcloud',
        externalIds: { isrc: 'US123' },
      }),
    ).toEqual(match);
  });

  it('names the supposed copyright owner in uploader notices', () => {
    expect(copyrightUploaderNoticeTitle('My Demo')).toBe(
      'Possible copyright match on "My Demo"',
    );
    expect(copyrightUploaderNoticeBody(match)).toBe(
      'ACRCloud matched this to "Blinding Lights" by The Weeknd. If you own or control that recording, we can still approve it — reply to support with proof.',
    );
    expect(buildCopyrightRejectionReason(match)).toContain(
      '"Blinding Lights" by The Weeknd',
    );
  });
});
