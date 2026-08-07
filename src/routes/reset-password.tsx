import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { KeyRound, Loader2 } from "lucide-react";

import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import { translateError } from "@/lib/error-messages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Redefinir senha — Omniasyn" },
      {
        name: "description",
        content:
          "Defina uma nova senha para acessar o painel de assistentes virtuais e chamadas.",
      },
      { property: "og:title", content: "Redefinir senha — Omniasyn" },
      {
        property: "og:description",
        content: "Defina uma nova senha para acessar sua conta.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowser();
    // O link de recuperação cria uma sessão temporária no cliente.
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) {
        toast.error(
          "Link de recuperação inválido ou expirado. Solicite um novo e-mail.",
        );
      }
      setReady(true);
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password !== confirm) {
      toast.error("As senhas não conferem.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Senha atualizada com sucesso!");
      navigate({ to: "/dashboard", replace: true });
    } catch (err) {
      toast.error(translateError(err, "Não foi possível atualizar a senha."));
    } finally {
      setLoading(false);
    }
  }

  if (!ready) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl bg-primary/15 text-primary shadow-glow">
            <KeyRound className="h-5 w-5" />
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
            Definir nova senha
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Escolha uma senha forte e exclusiva.
          </p>
        </div>

        <Card className="border-border bg-card/40 backdrop-blur-2xl">
          <CardContent className="p-6">
            <form className="space-y-4" onSubmit={handleSubmit}>
              <div className="space-y-1.5">
                <Label htmlFor="new-password" className="text-xs text-muted-foreground">
                  Nova senha
                </Label>
                <Input
                  id="new-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="confirm-password" className="text-xs text-muted-foreground">
                  Confirmar senha
                </Label>
                <Input
                  id="confirm-password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  className="bg-background/50"
                />
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2 shadow-glow">
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Salvar nova senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
