'use client';

import StudiosDirectoryPage from '@/app/(ProNetworx)/pro-networx/(dashboard)/studios/page';

export default function RadioStudiosPage() {
  return (
    <StudiosDirectoryPage
      studioPrefix="/studios"
      newStudioHref="/studios/me?new=1"
    />
  );
}
