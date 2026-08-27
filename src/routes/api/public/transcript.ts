import { createFileRoute } from "@tanstack/react-router";
import { timingSafeEqual } from "crypto";

/**
 * Webhook público que o worker Python do LiveKit chama para salvar
 * a transcrição (ata) de uma reunião no banco de dados.
 *
 * Autenticação: header `x-webhook-secret` deve corresponder ao
 * LIVEKIT_API_SECRET — o worker já possui essa chave configurada.
 *
 * Body JSON esperado:
 *   { "nome_sala": "reuniao-ABC123", "conteudo": "texto da transcrição..." }
 *
 * O `user_id` é preenchido automaticamente pelo trigger do banco
 * a partir do `nome_sala` (código da sala → meeting_rooms.user_id).
 */
export const Route = createFileRoute("/api/public/transcript")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // 1. Validar segredo (usa o LIVEKIT_API_SECRET que o worker já possui)
        const secret = request.headers.get("x-webhook-secret") ?? "";
        const expected = process.env["LIVEKIT_API_SECRET"] ?? "";
        if (!expected || !secret) {
          return json({ error: "Não autorizado" }, 401);
        }
        const a = Buffer.from(secret);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return json({ error: "Não autorizado" }, 401);
        }

        // 2. Parsear e validar body
        let body: { nome_sala?: string; conteudo?: string };
        try {
          body = await request.json();
        } catch {
          return json({ error: "JSON inválido" }, 400);
        }

        const nomeSala = (body.nome_sala ?? "").trim();
        const conteudo = (body.conteudo ?? "").trim();

        if (!nomeSala) {
          return json({ error: "Campo 'nome_sala' é obrigatório" }, 400);
        }
        if (!conteudo) {
          return json({ error: "Campo 'conteudo' é obrigatório" }, 400);
        }

        // 3. Inserir usando service_role (bypassa RLS)
        const { supabaseAdmin } = await import("@/integrations/supabase/admin.server");

        // Upsert: se já existe transcrição para esta sala, atualiza;
        // senão, insere nova linha.
        const { data: existing } = await supabaseAdmin
          .from("transcricoes_reunioes")
          .select("id")
          .eq("nome_sala", nomeSala)
          .limit(1);

        if (existing && existing.length > 0) {
          const { error } = await supabaseAdmin
            .from("transcricoes_reunioes")
            .update({ conteudo })
            .eq("id", existing[0].id);
          if (error) {
            console.error("[transcript-webhook] erro ao atualizar:", error.message);
            return json({ error: "Erro ao atualizar transcrição" }, 500);
          }
          return json({ ok: true, action: "updated" }, 200);
        }

        const { error: insertError } = await supabaseAdmin
          .from("transcricoes_reunioes")
          .insert({ nome_sala: nomeSala, conteudo });

        if (insertError) {
          console.error("[transcript-webhook] erro ao inserir:", insertError.message);
          return json({ error: "Erro ao salvar transcrição" }, 500);
        }

        return json({ ok: true, action: "created" }, 200);
      },
    },
  },
});

function json(data: unknown, status: number) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}
