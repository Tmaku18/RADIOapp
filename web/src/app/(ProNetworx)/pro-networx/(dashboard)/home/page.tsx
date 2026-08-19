'use client';

import { ProNetworxDirectoryContent } from '../../DirectoryContent';

export default function ProNetworxHomePage() {
  return (
    <ProNetworxDirectoryContent
      title="Discover Creatives"
      subtitle="Browse creatives by type, availability, and location."
      showEditProfile
      smartRanking
    />
  );
}
