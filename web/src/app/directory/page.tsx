import { permanentRedirect } from 'next/navigation';

/** Legacy /directory URL — keep on-site (indexable) instead of cross-domain Pro-Networx redirect. */
export default function DirectoryRouteRedirect() {
  permanentRedirect('/pro-directory');
}
