"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export function Tabs({ tabs }: { tabs: { id: string; title: string; content: React.ReactNode }[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  const initial = useMemo(() => search.get("tab") || tabs[0]?.id || "", [search, tabs]);
  const [active, setActive] = useState(initial);

  useEffect(() => {
    const q = new URLSearchParams(search.toString());
    q.set("tab", active);
    router.replace(`${pathname}?${q.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return (
    <div className="w-full space-y-8">
      {/* Tab Navigation */}
      <div className="flex justify-center">
        <div className="inline-flex p-1 bg-zinc-100 dark:bg-zinc-900 rounded-xl border border-zinc-200 dark:border-zinc-800">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActive(t.id)}
              className={`px-6 py-2 text-sm font-medium rounded-lg transition-all duration-200 ${active === t.id
                  ? "bg-white dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-700 dark:hover:text-zinc-300"
                }`}
            >
              {t.title}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="min-h-[400px]">
        {tabs.map(t => (
          <div
            key={t.id}
            className={`transition-opacity duration-300 ${active === t.id ? "opacity-100" : "opacity-0 hidden"}`}
          >
            {t.content}
          </div>
        ))}
      </div>
    </div>
  );
}
