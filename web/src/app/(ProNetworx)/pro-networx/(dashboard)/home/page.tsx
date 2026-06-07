'use client';

import { ProNetworxDirectoryContent } from '../../DirectoryContent';

export default function ProNetworxHomePage() {
  return (
    <ProNetworxDirectoryContent
      title="Discover Catalysts"
      subtitle="Browse the directory by skill, availability, and location."
      showEditProfile
      smartRanking
    />
  );
}
