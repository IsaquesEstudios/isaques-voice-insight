import { Bell, CreditCard, LogOut, Search, Settings, UserRound } from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SidebarTrigger } from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import { ThemeToggle } from "@/components/theme-toggle";
import { getMyProfile } from "@/lib/profile.functions";
import { useQuery } from "@tanstack/react-query";

function initialsFrom(name: string, email: string) {
  const base = name.trim() || email.trim();
  if (!base) return "?";
  const parts = base.split(/[\s@._-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

export function Topbar() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const profile = useQuery({
    queryKey: ["my-profile"],
    queryFn: () => getMyProfile(),
  });

  const displayName =
    profile.data?.fullName?.trim() || profile.data?.email || "Minha conta";
  const displayInitials = initialsFrom(
    profile.data?.fullName ?? "",
    profile.data?.email ?? "",
  );

  async function handleSignOut() {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      const supabase = getSupabaseBrowser();
      await supabase.auth.signOut();
      toast.success("Você saiu da conta.");
      navigate({ to: "/", replace: true });
    } catch (err) {
      toast.error("Falha ao sair. Tente novamente.");
      console.error(err);
    }
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border/60 bg-background/70 px-4 backdrop-blur-xl md:px-6">
      <SidebarTrigger className="text-muted-foreground hover:text-foreground" />

      <div className="relative hidden max-w-md flex-1 md:block">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar chamadas, leads, números..."
          className="h-10 rounded-xl border-border/70 bg-card/60 pl-9 text-sm"
        />
      </div>

      <div className="ml-auto flex items-center gap-2">
        <ThemeToggle />
        <Button
          variant="ghost"
          size="icon"
          className="relative rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-primary shadow-glow" />
        </Button>


        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-xl border border-border/60 bg-card/60 py-1.5 pl-1.5 pr-3 text-left transition-colors hover:bg-card">
              <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-chart-3 text-sm font-bold text-primary-foreground">
                {displayInitials}
              </span>
              <span className="hidden text-sm leading-tight sm:block">
                <span className="block max-w-[180px] truncate font-semibold text-foreground">
                  {displayName}
                </span>
                <span className="block max-w-[180px] truncate text-[11px] text-muted-foreground">
                  {profile.data?.email ?? ""}
                </span>
              </span>
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Minha conta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="cursor-pointer">
                <UserRound className="mr-2 h-4 w-4" /> Perfil
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="cursor-pointer">
                <CreditCard className="mr-2 h-4 w-4" /> Faturamento
              </Link>
            </DropdownMenuItem>
            <DropdownMenuItem asChild>
              <Link to="/configuracoes" className="cursor-pointer">
                <Settings className="mr-2 h-4 w-4" /> Configurações
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                handleSignOut();
              }}
              className="cursor-pointer text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" /> Sair
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
