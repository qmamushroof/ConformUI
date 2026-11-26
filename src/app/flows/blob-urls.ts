import type { BlobStore } from '@kernel';
import { useEffect, useState } from 'react';

/** Object URLs of stored blobs, by blob id; revoked when the ids change or the screen unmounts. */
export function useBlobUrls(blobs: BlobStore, ids: readonly string[]): Record<string, string> {
  const [urls, setUrls] = useState<Record<string, string>>({});
  const key = ids.join('|');
  // biome-ignore lint/correctness/useExhaustiveDependencies: `key` stands for the id list.
  useEffect(() => {
    let live = true;
    const made: string[] = [];
    (async () => {
      const out: Record<string, string> = {};
      for (const id of ids) {
        const blob = await blobs.get(id);
        if (!blob || typeof URL.createObjectURL !== 'function') continue;
        const url = URL.createObjectURL(blob);
        made.push(url);
        out[id] = url;
      }
      if (live) setUrls(out);
      else for (const u of made) URL.revokeObjectURL?.(u);
    })().catch(() => undefined);
    return () => {
      live = false;
      for (const u of made) URL.revokeObjectURL?.(u);
    };
  }, [blobs, key]);
  return urls;
}
