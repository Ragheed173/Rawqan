import { liveQuery } from "dexie";
import { useEffect, useState } from "react";
export function usePosLive<T>(query: () => Promise<T>, initial: T, dependencies: unknown[] = []) {
  const [value, setValue] = useState(initial);
  useEffect(() => { const subscription = liveQuery(query).subscribe({ next: setValue }); return () => subscription.unsubscribe(); }, dependencies);
  return value;
}
