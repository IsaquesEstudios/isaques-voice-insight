import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

interface StubPageProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

export function StubPage({ icon: Icon, title, description }: StubPageProps) {
  return (
    <div className="mx-auto max-w-2xl">
      <Card className="flex flex-col items-center gap-4 border-border/60 bg-card/70 p-10 text-center">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary shadow-glow">
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full border border-border/60 bg-background/50 px-3 py-1 text-xs text-muted-foreground">
          Em breve
        </span>
      </Card>
    </div>
  );
}
