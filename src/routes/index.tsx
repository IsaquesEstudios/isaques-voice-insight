import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { translateError } from "@/lib/error-messages";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Eye, EyeOff, Loader2, X } from "lucide-react";

import { getSupabaseBrowser } from "@/integrations/supabase/browser";
import { BrandLogo } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Entrar — Omniasyn" },
      {
        name: "description",
        content:
          "Acesse sua conta para gerenciar assistentes virtuais, números e chamadas.",
      },
    ],
  }),
  component: LoginHomePage,
});

function LoginHomePage() {
  const navigate = useNavigate();
  const [tab, setTabState] = useState<"signin" | "signup">("signin");
  const [mode, setMode] = useState<"auth" | "forgot">("auth");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);
  const [sent, setSent] = useState(false);
  const [alert, setAlert] = useState<
    { type: "error" | "success"; message: string } | null
  >(null);

  const setTab = (value: "signin" | "signup") => {
    setTabState(value);
    setConfirmPassword("");
    setAlert(null);
  };

  // Usuário já autenticado → mandar para o dashboard.
  useEffect(() => {
    const supabase = getSupabaseBrowser();
    supabase.auth.getUser().then(({ data }) => {
      if (data.user) {
        navigate({ to: "/dashboard", replace: true });
      } else {
        setChecking(false);
      }
    });
  }, [navigate]);

  const handleForgot = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setSent(true);
      setAlert({
        type: "success",
        message:
          "Se este e-mail estiver cadastrado, você receberá um link de recuperação na caixa de entrada.",
      });
    } catch (err) {
      setAlert({
        type: "error",
        message: translateError(err, "Falha ao enviar o e-mail de recuperação"),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setAlert(null);

    if (tab === "signup" && password !== confirmPassword) {
      setAlert({
        type: "error",
        message:
          "As senhas não coincidem. Digite a mesma senha nos dois campos.",
      });
      return;
    }

    setLoading(true);
    const supabase = getSupabaseBrowser();
    try {
      if (tab === "signin") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
        setAlert({ type: "success", message: "Bem-vindo de volta!" });
        navigate({ to: "/dashboard", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          setAlert({ type: "success", message: "Conta criada!" });
          navigate({ to: "/dashboard", replace: true });
        } else {
          setTabState("signin");
          setConfirmPassword("");
          setAlert({
            type: "success",
            message:
              "Conta criada. Verifique seu e-mail para confirmar (se necessário).",
          });
        }
      }
    } catch (err) {
      setAlert({
        type: "error",
        message: translateError(err, "Falha na autenticação"),
      });
    } finally {
      setLoading(false);
    }
  };


  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center text-center">
          <BrandLogo className="h-9" />
          <p className="mt-2 text-sm text-muted-foreground">
            AI Voice — acesso à plataforma
          </p>
        </div>


        <Card className="border-border bg-card/40 backdrop-blur-2xl">
          <CardContent className="p-6">
            {alert && (
              <div
                role="alert"
                aria-live="assertive"
                className={`mb-5 flex items-start gap-2 rounded-lg border p-3 text-xs ${
                  alert.type === "error"
                    ? "border-destructive/40 bg-destructive/10 text-destructive"
                    : "border-success/40 bg-success/10 text-foreground"
                }`}
              >
                {alert.type === "error" ? (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                ) : (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                )}
                <p className="flex-1 leading-relaxed whitespace-pre-line">
                  {alert.message}
                </p>
                <button
                  type="button"
                  aria-label="Fechar alerta"
                  onClick={() => setAlert(null)}
                  className="shrink-0 opacity-70 transition hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
            {mode === "forgot" ? (
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  Esqueci minha senha
                </h2>
                <p className="mb-4 mt-1 text-xs text-muted-foreground">
                  Informe seu e-mail. Se existir uma conta cadastrada, você
                  receberá na caixa de entrada um link para criar uma nova senha.
                </p>
                <form className="space-y-4" onSubmit={handleForgot}>
                  <div className="space-y-1.5">
                    <Label htmlFor="forgot-email" className="text-xs text-muted-foreground">
                      E-mail
                    </Label>
                    <Input
                      id="forgot-email"
                      type="email"
                      autoComplete="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="bg-background/50"
                    />
                  </div>
                  {sent && (
                    <p className="rounded-lg border border-border/60 bg-background/40 p-3 text-xs text-muted-foreground">
                      E-mail enviado. Verifique também a pasta de spam — o link
                      expira em alguns minutos.
                    </p>
                  )}
                  <Button type="submit" disabled={loading} className="w-full gap-2 shadow-glow">
                    {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                    Enviar link de recuperação
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-xs text-muted-foreground"
                    onClick={() => {
                      setMode("auth");
                      setSent(false);
                    }}
                  >
                    Voltar para o login
                  </Button>
                </form>
              </div>
            ) : (
            <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
              <TabsList className="grid w-full grid-cols-2 bg-background/40">
                <TabsTrigger value="signin">Entrar</TabsTrigger>
                <TabsTrigger value="signup">Criar conta</TabsTrigger>
              </TabsList>

              <TabsContent value="signin" className="mt-6">
                <p className="mb-4 text-xs text-muted-foreground">
                  Use seu e-mail e senha para acessar.
                </p>
              </TabsContent>
              <TabsContent value="signup" className="mt-6">
                <p className="mb-4 text-xs text-muted-foreground">
                  Crie sua conta para gerenciar assistentes e números.
                </p>
              </TabsContent>

              <form className="space-y-4" onSubmit={handleSubmit}>
                <div className="space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground">
                    E-mail
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="bg-background/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">
                    Senha
                  </Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      autoComplete={
                        tab === "signin" ? "current-password" : "new-password"
                      }
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="bg-background/50 pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                      className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="h-4 w-4" />
                      ) : (
                        <Eye className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </div>
                {tab === "signup" && (
                  <div className="space-y-1.5">
                    <Label
                      htmlFor="confirm-password"
                      className="text-xs text-muted-foreground"
                    >
                      Confirmar senha
                    </Label>
                    <div className="relative">
                      <Input
                        id="confirm-password"
                        type={showConfirmPassword ? "text" : "password"}
                        autoComplete="new-password"
                        required
                        minLength={6}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="bg-background/50 pr-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword((v) => !v)}
                        aria-label={
                          showConfirmPassword ? "Ocultar senha" : "Mostrar senha"
                        }
                        className="absolute inset-y-0 right-0 grid w-10 place-items-center text-muted-foreground hover:text-foreground"
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                )}

                <Button
                  type="submit"
                  disabled={loading}
                  className="w-full gap-2 shadow-glow"
                >
                  {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                  {tab === "signin" ? "Entrar" : "Criar conta"}
                </Button>
                {tab === "signin" && (
                  <button
                    type="button"
                    onClick={() => setMode("forgot")}
                    className="w-full text-center text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
                  >
                    Esqueci minha senha
                  </button>
                )}
              </form>
            </Tabs>
            )}
          </CardContent>
        </Card>


        <p className="text-center text-xs text-muted-foreground">
          Área restrita — acesso somente para clientes autenticados.
        </p>
      </div>
    </div>
  );
}
