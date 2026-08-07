import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type MyProfile = {
  id: string;
  fullName: string;
  company: string;
  email: string;
  timezone: string;
  avatarUrl: string | null;
};

export const getMyProfile = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }): Promise<MyProfile> => {
    const { supabase, userId, claims } = context;
    const authEmail = (claims as { email?: string } | null)?.email ?? "";

    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, company, email, timezone, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error) throw new Error(`Falha ao carregar perfil: ${error.message}`);

    if (!data) {
      // Conta antiga (criada antes da tabela de perfis): cria na hora.
      const { data: created, error: insErr } = await supabase
        .from("profiles")
        .insert({ id: userId, email: authEmail })
        .select("id, full_name, company, email, timezone, avatar_url")
        .single();
      if (insErr) throw new Error(`Falha ao criar perfil: ${insErr.message}`);
      return {
        id: created.id,
        fullName: created.full_name ?? "",
        company: created.company ?? "",
        email: created.email ?? authEmail,
        timezone: created.timezone ?? "America/Sao_Paulo",
        avatarUrl: created.avatar_url ?? null,
      };
    }

    return {
      id: data.id,
      fullName: data.full_name ?? "",
      company: data.company ?? "",
      email: data.email ?? authEmail,
      timezone: data.timezone ?? "America/Sao_Paulo",
      avatarUrl: data.avatar_url ?? null,
    };
  });

const updateSchema = z.object({
  fullName: z.string().trim().max(120).optional(),
  company: z.string().trim().max(120).optional(),
  timezone: z.string().trim().max(80).optional(),
});

export const updateMyProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => updateSchema.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const patch: Record<string, string> = {};
    if (data.fullName !== undefined) patch['full_name'] = data.fullName;
    if (data.company !== undefined) patch['company'] = data.company;
    if (data.timezone !== undefined && data.timezone)
      patch['timezone'] = data.timezone;

    const { error } = await supabase
      .from("profiles")
      .update(patch)
      .eq("id", userId);
    if (error) throw new Error(`Falha ao salvar perfil: ${error.message}`);
    return { ok: true as const };
  });
