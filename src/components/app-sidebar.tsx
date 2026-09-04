import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Activity, Sparkles, Globe2, Radio, SlidersHorizontal } from "lucide-react";

const NAV = [
  { to: "/protocol", label: "Intelligence Protocol", icon: Radio },
  { to: "/regions", label: "Regions", icon: Globe2 },
  { to: "/briefing", label: "AI Briefing", icon: Sparkles },
  { to: "/scenarios", label: "Scenario Modeller", icon: SlidersHorizontal },
  { to: "/report", label: "Generate Report", icon: FileText },
] as const;

export function AppSidebar() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <aside className="hidden md:flex w-64 flex-col bg-sidebar text-sidebar-foreground border-r border-sidebar-border">
      <div className="px-5 py-5 border-b border-sidebar-border flex items-center gap-2">
        <div className="w-8 h-8 rounded-md bg-sidebar-accent flex items-center justify-center">
          <Activity className="w-4 h-4 text-white" />
        </div>
        <div>
          <div className="text-base font-semibold tracking-tight">Grip</div>
          <div className="text-[11px] text-sidebar-muted">Physical climate risk intelligence</div>
        </div>
      </div>
      <nav className="flex-1 p-3 space-y-1">
        {NAV.map(({ to, label, icon: Icon }) => {
          const active = pathname === to || pathname.startsWith(to + "/");
          return (
            <Link
              key={to}
              to={to}
              className={`flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors ${
                active
                  ? "bg-sidebar-accent text-white"
                  : "text-sidebar-foreground/80 hover:bg-white/5 hover:text-white"
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{label}</span>
            </Link>
          );
        })}
      </nav>
      <div className="p-4 text-[11px] text-sidebar-muted border-t border-sidebar-border">
        Open-data physical climate risk · IPCC AR6 aligned
      </div>
    </aside>
  );
}
