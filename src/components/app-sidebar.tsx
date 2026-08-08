import { Link, useRouterState } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Megaphone,
  Video,
  Settings,
  Sparkles,
  Phone,
  Loader2,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { getVapiBilling, getVapiEstimatedCredits } from "@/lib/vapi.functions";
import { BrandLogo } from "@/components/brand-logo";


type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  activePaths?: string[];
};

const nav: NavItem[] = [
  { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
  {
    title: "Assistentes Virtuais",
    url: "/assistentes",
    icon: Bot,
    activePaths: ["/assistentes", "/assistants/"],
  },
  { title: "Campanhas", url: "/campanhas", icon: Megaphone },
  { title: "Telefonia & Números", url: "/telefonia", icon: PhoneCall },
  { title: "Reunião em vídeo", url: "/reunioes", icon: Video },
  { title: "Configurações / API", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <BrandLogo className="h-5" />
            <p className="mt-0.5 truncate text-xs text-muted-foreground">AI Voice</p>
          </div>
        </div>
      </SidebarHeader>


      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Plataforma</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {nav.map((item) => {
                const active = (item.activePaths ?? [item.url]).some((path) =>
                  pathname.startsWith(path)
                );
                return (
                  <SidebarMenuItem key={item.url}>
                    <SidebarMenuButton
                      asChild
                      isActive={active}
                      tooltip={item.title}
                      className="data-[active=true]:bg-sidebar-accent data-[active=true]:text-primary"
                    >
                      <Link to={item.url} className="flex items-center gap-3">
                        <item.icon className="h-4 w-4" />
                        <span>{item.title}</span>
                      </Link>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="border-t border-sidebar-border">
        <SidebarCredits />
      </SidebarFooter>
    </Sidebar>
  );
}

function SidebarCredits() {
  const vapiCredits = useQuery({
    queryKey: ["vapi-estimated-credits"],
    queryFn: () => getVapiEstimatedCredits(),
    staleTime: 60_000,
  });

  const vapiValue =
    vapiCredits.data?.ok && vapiCredits.data?.balance !== null
      ? vapiCredits.data.balance
      : null;

  return (
    <div className="space-y-3 group-data-[collapsible=icon]:hidden">
      <SidebarCreditRow
        icon={Sparkles}
        title="Vapi"
        value={vapiValue}
        currency="USD"
        badge={vapiCredits.data?.ok ? "estimado" : undefined}
        loading={vapiCredits.isLoading}
        usageRatio={vapiCredits.data?.usageRatio}
        lowBalance={vapiCredits.data?.lowBalance}
      />
    </div>
  );
}

function SidebarCreditRow({
  icon: Icon,
  title,
  value,
  currency,
  badge,
  loading,
  usageRatio,
  lowBalance,
}: {
  icon: typeof Phone;
  title: string;
  value: number | null;
  currency: string;
  badge?: string;
  loading: boolean;
  usageRatio?: number;
  lowBalance?: boolean;
}) {
  const ratio = typeof usageRatio === "number" ? usageRatio : typeof value === "number" ? 0.65 : 0;
  const barColor =
    lowBalance ? "bg-destructive" : ratio > 0.8 ? "bg-amber-500" : "bg-primary";

  return (
    <div className="rounded-xl border border-sidebar-border bg-gradient-to-br from-primary/10 to-transparent p-3">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Icon className="h-3.5 w-3.5 text-primary" />
          <p className="text-xs font-semibold text-sidebar-foreground">{title}</p>
        </div>
        {badge ? (
          <span className="rounded-full bg-primary/15 px-1.5 py-0 text-[9px] font-semibold text-primary">
            {badge}
          </span>
        ) : null}
      </div>
      <div className="mt-1.5">
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        ) : typeof value === "number" ? (
          <p className="text-sm font-bold text-sidebar-foreground">
            {new Intl.NumberFormat("pt-BR", { style: "currency", currency }).format(value)}
          </p>
        ) : (
          <p className="text-xs text-muted-foreground">Não conectado</p>
        )}
      </div>
      <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-sidebar-accent">
        <div
          className={`h-full rounded-full ${barColor} transition-all`}
          style={{ width: `${Math.round(ratio * 100)}%` }}
        />
      </div>
    </div>
  );
}
