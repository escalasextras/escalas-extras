"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

export type IconName = "check" | "grid" | "plus" | "people" | "gear";
export type NavItem = { href: string; label: string; icon: IconName; badge?: number };

const PATHS: Record<IconName, React.ReactNode> = {
  check: <><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.8 2.8L16.5 9.5" /></>,
  grid: <><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8.5 3.5v3M15.5 3.5v3" /></>,
  plus: <><circle cx="12" cy="12" r="9" /><path d="M12 8v8M8 12h8" /></>,
  people: <><circle cx="9" cy="8.5" r="3.2" /><path d="M3.5 19c.5-3.2 2.8-5 5.5-5s5 1.8 5.5 5" /><path d="M16 6.2a3 3 0 0 1 0 5.6M17.5 14.3c1.7.6 2.7 2.2 3 4.7" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M12 3.5v2.2M12 18.3v2.2M3.5 12h2.2M18.3 12h2.2M6 6l1.5 1.5M16.5 16.5 18 18M18 6l-1.5 1.5M7.5 16.5 6 18" /></>,
};

export function Icon({ name, className = "h-6 w-6" }: { name: IconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
      {PATHS[name]}
    </svg>
  );
}

export default function Nav({ items }: { items: NavItem[] }) {
  const path = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-20 border-t border-stone-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur" aria-label="Principal">
      <ul className="mx-auto flex max-w-xl px-2">
        {items.map((it) => {
          const on = path === it.href || path.startsWith(it.href + "/");
          return (
            <li key={it.href} className="flex-1">
              <Link
                href={it.href}
                aria-current={on ? "page" : undefined}
                className={`relative flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-semibold ${on ? "text-teal-700" : "text-stone-500"}`}
              >
                <span className={`grid h-8 w-14 place-items-center rounded-full transition-colors ${on ? "bg-teal-100" : ""}`}>
                  <Icon name={it.icon} className="h-[22px] w-[22px]" />
                </span>
                {it.label}
                {!!it.badge && (
                  <span className="absolute right-[calc(50%-34px)] top-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-brasa-500 px-1 text-[11px] font-bold text-white">
                    {it.badge}
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
