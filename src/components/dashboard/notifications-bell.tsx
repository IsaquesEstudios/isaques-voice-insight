import { Bell, Check, ChevronRight, Bot, Video } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { listLivekitAgents } from "@/lib/livekit.functions";

type Task = {
  id: string;
  title: string;
  description: string;
  to: string;
  icon: typeof Bot;
  done: boolean;
};

export function NotificationsBell() {
  const agents = useQuery({
    queryKey: ["livekit-agents"],
    queryFn: () => listLivekitAgents().catch(() => []),
    retry: false,
  });

  const tasks: Task[] = [
    {
      id: "assistant",
      title: "Construa seu atendente",
      description: "Crie sua assistente virtual e defina como ela deve atender.",
      to: "/assistentes",
      icon: Bot,
      done: (agents.data?.length ?? 0) > 0,
    },
    {
      id: "meeting",
      title: "Crie sua primeira reunião",
      description: "Use as salas de vídeo com transcrição automática.",
      to: "/reunioes",
      icon: Video,
      done: false,
    },
  ];

  const pending = tasks.filter((t) => !t.done);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Notificações"
          className="relative rounded-xl text-muted-foreground hover:text-foreground"
        >
          <Bell className="h-4 w-4" />
          {pending.length > 0 && (
            <span className="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground shadow-glow">
              {pending.length}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="border-b border-border/60 px-4 py-3">
          <p className="text-sm font-semibold text-foreground">Primeiros passos</p>
          <p className="text-xs text-muted-foreground">
            {pending.length === 0
              ? "Tudo pronto! Sua operação está configurada."
              : `${pending.length} etapa(s) para concluir sua configuração.`}
          </p>
        </div>
        <ul className="max-h-[320px] overflow-y-auto p-2">
          {tasks.map((task) => {
            const Icon = task.icon;
            return (
              <li key={task.id}>
                <Link
                  to={task.to}
                  className="flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-muted/60"
                >
                  <span
                    className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-lg ${
                      task.done
                        ? "bg-muted text-muted-foreground"
                        : "bg-gradient-to-br from-primary to-chart-3 text-primary-foreground"
                    }`}
                  >
                    {task.done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span
                      className={`block text-sm font-medium ${
                        task.done ? "text-muted-foreground line-through" : "text-foreground"
                      }`}
                    >
                      {task.title}
                    </span>
                    <span className="block text-xs text-muted-foreground">
                      {task.done ? "Concluído" : task.description}
                    </span>
                  </span>
                  {!task.done && (
                    <ChevronRight className="mt-2 h-4 w-4 shrink-0 text-muted-foreground" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </PopoverContent>
    </Popover>
  );
}
