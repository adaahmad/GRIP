import { ChevronRight } from "lucide-react";

export function Breadcrumb({ items }: { items: string[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <ChevronRight className="w-3 h-3" />}
          <span className={i === items.length - 1 ? "text-foreground font-medium" : ""}>{item}</span>
        </span>
      ))}
    </nav>
  );
}
