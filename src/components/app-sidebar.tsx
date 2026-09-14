import { Link, useRouterState } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Bot,
  PhoneCall,
  Headphones,
  Megaphone,
  Video,
  Settings,
  Hash,
  MessageCircle,
} from "lucide-react";

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { BrandLogo } from "@/components/brand-logo";


type NavItem = {
  title: string;
  url: string;
  icon: LucideIcon;
  activePaths?: string[];
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Plataforma",
    items: [
      { title: "Dashboard", url: "/dashboard", icon: LayoutDashboard },
      {
        title: "Assistentes Virtuais",
        url: "/assistentes",
        icon: Bot,
        activePaths: ["/assistentes"],
      },
    ],
  },
  {
    label: "Ligação",
    items: [
      { title: "Ligação", url: "/ligacao", icon: PhoneCall },
      { title: "Recepcionista", url: "/atendente-ia", icon: Headphones },
      { title: "Campanhas", url: "/campanhas", icon: Megaphone },
    ],
  },
  {
    label: "WhatsApp",
    items: [
      { title: "Números de WhatsApp", url: "/whatsapp-numeros", icon: Hash },
      { title: "WhatsApp", url: "/whatsapp", icon: MessageCircle },
    ],
  },
  {
    label: "Outros",
    items: [
      { title: "Reunião em vídeo", url: "/reunioes", icon: Video },
      { title: "Configurações / API", url: "/configuracoes", icon: Settings },
    ],
  },
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
        {groups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
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
        ))}
      </SidebarContent>

    </Sidebar>
  );
}
