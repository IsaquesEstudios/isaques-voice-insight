import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Video,
  Inbox,
  ListChecks,
  Settings,
  Sparkles,
  AudioLines,
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
  { title: "Telefonia & Números", url: "/telefonia", icon: PhoneCall },
  { title: "Reunião em vídeo", url: "/reunioes", icon: Video },
  { title: "CRM & Leads", url: "/crm", icon: Inbox },
  { title: "Histórico de Chamadas", url: "/historico", icon: ListChecks },
  { title: "Configurações / API", url: "/configuracoes", icon: Settings },
];

export function AppSidebar() {
  const pathname = useRouterState({ select: (r) => r.location.pathname });

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="border-b border-sidebar-border">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground shadow-glow">
            <AudioLines className="h-5 w-5" />
          </div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <p className="truncate text-sm font-bold leading-tight text-sidebar-foreground">
              Isaques Estúdios
            </p>
            <p className="truncate text-xs text-muted-foreground">| AI Voice</p>
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
        <div className="rounded-xl border border-sidebar-border bg-gradient-to-br from-primary/15 to-transparent p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-xs font-semibold text-sidebar-foreground">Plano Growth</p>
          </div>
          <p className="mt-1 text-[11px] leading-snug text-muted-foreground">
            Você usou 62% dos créditos deste ciclo.
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-sidebar-accent">
            <div className="h-full w-[62%] rounded-full bg-primary" />
          </div>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
