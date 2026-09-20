import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/external-auth-middleware";

const GRAPH = "https://graph.facebook.com/v26.0";

/** Dados públicos necessários para abrir o Cadastro Incorporado da Meta. */
export const obterConfigWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const appId = process.env["META_APP_ID"];
    const configId = process.env["META_WHATSAPP_CONFIG_ID"];
    return {
      appId: appId ?? null,
      configId: configId ?? null,
      configurado: Boolean(appId && configId && process.env["META_APP_SECRET"]),
    };
  });

export const listarNumerosWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_numeros")
      .select("id, waba_id, phone_number_id, display_phone_number, verified_name, status")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

/** Rebusca na Meta os números das contas já autorizadas pelo usuário. */
export const sincronizarNumerosWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: contas, error: contasError } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("waba_id, access_token")
      .eq("user_id", context.userId);
    if (contasError) throw new Error(contasError.message);
    if (!contas || contas.length === 0) {
      throw new Error("Nenhuma conta do WhatsApp conectada ainda.");
    }

    const appId = process.env["META_APP_ID"];
    const appSecret = process.env["META_APP_SECRET"];

    // Um mesmo login pode autorizar mais de uma conta comercial; descobre todas.
    const pares = new Map<string, string>();
    for (const conta of contas) {
      if (!conta.access_token) continue;
      pares.set(conta.waba_id, conta.access_token);
      if (!appId || !appSecret) continue;
      const dbg = await fetch(
        `${GRAPH}/debug_token?input_token=${encodeURIComponent(
          conta.access_token
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
      );
      const dbgJson = (await dbg.json()) as {
        data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
      };
      for (const escopo of dbgJson.data?.granular_scopes ?? []) {
        if (escopo.scope !== "whatsapp_business_management") continue;
        for (const alvo of escopo.target_ids ?? []) {
          if (!pares.has(alvo)) pares.set(alvo, conta.access_token);
        }
      }
    }

    let total = 0;
    for (const [wabaId, token] of pares) {
      const res = await fetch(
        `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status`,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      const json = (await res.json()) as {
        data?: {
          id: string;
          display_phone_number?: string;
          verified_name?: string;
          code_verification_status?: string;
        }[];
        error?: { message?: string };
      };
      if (!res.ok) continue;
      const lista = json.data ?? [];
      if (lista.length === 0) continue;

      await supabaseAdmin.from("whatsapp_accounts").upsert(
        { user_id: context.userId, waba_id: wabaId, access_token: token },
        { onConflict: "user_id,waba_id" }
      );

      const { error } = await supabaseAdmin.from("whatsapp_numeros").upsert(
        lista.map((n) => ({
          user_id: context.userId,
          waba_id: wabaId,
          phone_number_id: n.id,
          display_phone_number: n.display_phone_number ?? null,
          verified_name: n.verified_name ?? null,
          status: n.code_verification_status === "VERIFIED" ? "conectado" : "pendente",
        })),
        { onConflict: "phone_number_id" }
      );
      if (error) throw new Error(error.message);
      total += lista.length;
    }

    return {
      ok: true,
      total,
      aviso:
        total === 0
          ? `A Meta autorizou ${pares.size} conta(s) comercial(is), mas nenhuma delas tem número cadastrado. Adicione e verifique o número no WhatsApp Manager e clique em Atualizar números.`
          : null,
    };

  });


export const removerNumeroWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { id: string }) => {
    if (!input?.id) throw new Error("Número inválido.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { error } = await supabaseAdmin
      .from("whatsapp_numeros")
      .delete()
      .eq("id", data.id)
      .eq("user_id", context.userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

type ConectarInput = {
  code: string;
  wabaId?: string | null;
  phoneNumberId?: string | null;
};

/** Troca o código do Cadastro Incorporado por um token e salva os números da conta. */
export const conectarWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: ConectarInput) => {
    if (!input?.code) throw new Error("Código de autorização ausente.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const appId = process.env["META_APP_ID"];
    const appSecret = process.env["META_APP_SECRET"];
    if (!appId || !appSecret) {
      throw new Error("A integração com a Meta ainda não está configurada nesta conta.");
    }

    const tokenRes = await fetch(
      `${GRAPH}/oauth/access_token?client_id=${encodeURIComponent(appId)}&client_secret=${encodeURIComponent(
        appSecret
      )}&code=${encodeURIComponent(data.code)}`
    );
    const tokenJson = (await tokenRes.json()) as {
      access_token?: string;
      error?: { message?: string };
    };
    if (!tokenRes.ok || !tokenJson.access_token) {
      throw new Error(
        tokenJson.error?.message ?? "Não foi possível concluir a conexão com a Meta."
      );
    }
    const accessToken = tokenJson.access_token;

    let wabaId = data.wabaId ?? null;
    if (!wabaId) {
      const dbg = await fetch(
        `${GRAPH}/debug_token?input_token=${encodeURIComponent(
          accessToken
        )}&access_token=${encodeURIComponent(`${appId}|${appSecret}`)}`
      );
      const dbgJson = (await dbg.json()) as {
        data?: { granular_scopes?: { scope: string; target_ids?: string[] }[] };
      };
      wabaId =
        dbgJson.data?.granular_scopes?.find(
          (s) => s.scope === "whatsapp_business_management"
        )?.target_ids?.[0] ?? null;
    }
    if (!wabaId) {
      throw new Error(
        "Não encontramos uma conta comercial do WhatsApp vinculada a esse login."
      );
    }

    // Assina o app para receber as mensagens dessa conta comercial.
    const assinaturaRes = await fetch(`${GRAPH}/${wabaId}/subscribed_apps`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!assinaturaRes.ok) {
      const assinaturaJson = (await assinaturaRes.json()) as {
        error?: { message?: string; code?: number };
      };
      const codigo = assinaturaJson.error?.code
        ? ` (código ${assinaturaJson.error.code})`
        : "";
      throw new Error(
        `${assinaturaJson.error?.message ?? "A Meta não permitiu assinar as mensagens desta conta."}${codigo}`
      );
    }

    const numerosRes = await fetch(
      `${GRAPH}/${wabaId}/phone_numbers?fields=id,display_phone_number,verified_name,code_verification_status`,
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    const numerosJson = (await numerosRes.json()) as {
      data?: {
        id: string;
        display_phone_number?: string;
        verified_name?: string;
        code_verification_status?: string;
      }[];
      error?: { message?: string };
    };
    if (!numerosRes.ok) {
      throw new Error(numerosJson.error?.message ?? "Não foi possível listar os números.");
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { error: contaError } = await supabaseAdmin.from("whatsapp_accounts").upsert(
      { user_id: context.userId, waba_id: wabaId, access_token: accessToken },
      { onConflict: "user_id,waba_id" }
    );
    if (contaError) throw new Error(contaError.message);

    type NumeroMeta = {
      id: string;
      display_phone_number?: string;
      verified_name?: string;
      code_verification_status?: string;
    };

    const todos: NumeroMeta[] = numerosJson.data ?? [];
    let lista = data.phoneNumberId
      ? todos.filter((n) => n.id === data.phoneNumberId)
      : todos;

    // Se o filtro não bateu, mantemos todos os números da conta comercial.
    if (lista.length === 0 && todos.length > 0) lista = todos;

    // Último recurso: buscar o número escolhido diretamente pelo ID.
    if (lista.length === 0 && data.phoneNumberId) {
      const unicoRes = await fetch(
        `${GRAPH}/${data.phoneNumberId}?fields=id,display_phone_number,verified_name,code_verification_status`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      const unicoJson = (await unicoRes.json()) as NumeroMeta & {
        error?: { message?: string };
      };
      if (unicoRes.ok && unicoJson.id) lista = [unicoJson];
    }

    if (lista.length === 0) {
      throw new Error(
        "A conexão foi autorizada, mas a Meta não retornou nenhum número nessa conta comercial. Verifique se o número já foi cadastrado e verificado no WhatsApp Manager."
      );
    }

    const { error } = await supabaseAdmin.from("whatsapp_numeros").upsert(
      lista.map((n) => ({
        user_id: context.userId,
        waba_id: wabaId!,
        phone_number_id: n.id,
        display_phone_number: n.display_phone_number ?? null,
        verified_name: n.verified_name ?? null,
        status: n.code_verification_status === "VERIFIED" ? "conectado" : "pendente",
      })),
      { onConflict: "phone_number_id" }
    );
    if (error) throw new Error(error.message);

    return { ok: true, total: lista.length };

  });

/* ------------------------------ Conversas ------------------------------ */

export const listarConversasWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_conversas")
      .select(
        "id, phone_number_id, contato_wa_id, contato_nome, ultima_mensagem, ultima_em, nao_lidas"
      )
      .eq("user_id", context.userId)
      .order("ultima_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const listarMensagensWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversaId: string }) => {
    if (!input?.conversaId) throw new Error("Conversa inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: mensagens, error } = await supabaseAdmin
      .from("whatsapp_mensagens")
      .select("id, direcao, texto, tipo, status, criado_em")
      .eq("conversa_id", data.conversaId)
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);

    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({ nao_lidas: 0 })
      .eq("id", data.conversaId)
      .eq("user_id", context.userId);

    return mensagens ?? [];
  });

export const enviarMensagemWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversaId: string; texto: string }) => {
    if (!input?.conversaId) throw new Error("Conversa inválida.");
    if (!input?.texto?.trim()) throw new Error("Escreva uma mensagem antes de enviar.");
    return { conversaId: input.conversaId, texto: input.texto.trim() };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: conversa, error: conversaError } = await supabaseAdmin
      .from("whatsapp_conversas")
      .select("id, phone_number_id, contato_wa_id")
      .eq("id", data.conversaId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (conversaError) throw new Error(conversaError.message);
    if (!conversa) throw new Error("Conversa não encontrada.");

    const { data: numero } = await supabaseAdmin
      .from("whatsapp_numeros")
      .select("waba_id")
      .eq("phone_number_id", conversa.phone_number_id)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!numero) throw new Error("Número não está mais conectado.");

    const { data: conta } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("access_token")
      .eq("user_id", context.userId)
      .eq("waba_id", numero.waba_id)
      .maybeSingle();
    if (!conta?.access_token) {
      throw new Error("A autorização da Meta expirou. Conecte o WhatsApp novamente.");
    }

    const envioRes = await fetch(`${GRAPH}/${conversa.phone_number_id}/messages`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${conta.access_token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to: conversa.contato_wa_id,
        type: "text",
        text: { body: data.texto },
      }),
    });
    const envioJson = (await envioRes.json()) as {
      messages?: { id: string }[];
      error?: { message?: string; code?: number };
    };
    if (!envioRes.ok) {
      const codigo = envioJson.error?.code ? ` (código ${envioJson.error.code})` : "";
      throw new Error(
        `${envioJson.error?.message ?? "A Meta recusou o envio da mensagem."}${codigo}`
      );
    }

    await supabaseAdmin.from("whatsapp_mensagens").insert({
      conversa_id: conversa.id,
      user_id: context.userId,
      wa_message_id: envioJson.messages?.[0]?.id ?? null,
      direcao: "saida",
      tipo: "text",
      texto: data.texto,
      status: "enviada",
    });

    await supabaseAdmin
      .from("whatsapp_conversas")
      .update({ ultima_mensagem: data.texto, ultima_em: new Date().toISOString() })
      .eq("id", conversa.id);

    return { ok: true };
  });
