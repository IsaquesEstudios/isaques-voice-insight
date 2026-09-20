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
      return {
        ok: true,
        total: 0,
        aviso:
          "A conexão foi autorizada, mas essa conta comercial ainda não tem número cadastrado. Adicione e verifique o número no WhatsApp Manager e clique em Atualizar números.",
      };
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

    return { ok: true, total: lista.length, aviso: null };


  });

/* ----------------- Cadastro de número pelo painel ----------------- */

async function tokenDaConta(userId: string, wabaId: string) {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  const { data } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select("access_token")
    .eq("user_id", userId)
    .eq("waba_id", wabaId)
    .maybeSingle();
  if (!data?.access_token) {
    throw new Error("A autorização da Meta expirou. Conecte o WhatsApp novamente.");
  }
  return data.access_token;
}

async function erroMeta(res: Response, padrao: string) {
  const json = (await res.json().catch(() => ({}))) as {
    error?: { message?: string; error_user_msg?: string; code?: number };
  };
  const msg = json.error?.error_user_msg ?? json.error?.message ?? padrao;
  const codigo = json.error?.code ? ` (código ${json.error.code})` : "";
  return new Error(`${msg}${codigo}`);
}

/** Contas comerciais já autorizadas, para escolher onde cadastrar o número. */
export const listarContasWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data, error } = await supabaseAdmin
      .from("whatsapp_accounts")
      .select("waba_id")
      .eq("user_id", context.userId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return (data ?? []).map((c) => ({ wabaId: c.waba_id }));
  });

/** Cadastra o número na conta comercial e pede o código de verificação. */
export const cadastrarNumeroWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (input: {
      wabaId: string;
      ddi: string;
      numero: string;
      nomeExibicao: string;
      metodo: "SMS" | "VOICE";
    }) => {
      const ddi = (input?.ddi ?? "").replace(/\D/g, "");
      const numero = (input?.numero ?? "").replace(/\D/g, "");
      const nomeExibicao = (input?.nomeExibicao ?? "").trim();
      if (!input?.wabaId) throw new Error("Escolha a conta comercial.");
      if (!ddi || ddi.length > 4) throw new Error("Informe um código de país válido.");
      if (numero.length < 8 || numero.length > 15)
        throw new Error("Informe um número de telefone válido.");
      if (nomeExibicao.length < 2 || nomeExibicao.length > 60)
        throw new Error("O nome de exibição deve ter entre 2 e 60 caracteres.");
      return {
        wabaId: input.wabaId,
        ddi,
        numero,
        nomeExibicao,
        metodo: input.metodo === "VOICE" ? ("VOICE" as const) : ("SMS" as const),
      };
    }
  )
  .handler(async ({ data, context }) => {
    const token = await tokenDaConta(context.userId, data.wabaId);

    const criarRes = await fetch(`${GRAPH}/${data.wabaId}/phone_numbers`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        cc: data.ddi,
        phone_number: data.numero,
        verified_name: data.nomeExibicao,
      }),
    });
    const criarJson = (await criarRes.clone().json().catch(() => ({}))) as { id?: string };
    if (!criarRes.ok || !criarJson.id) {
      throw await erroMeta(criarRes, "A Meta não aceitou o cadastro desse número.");
    }
    const phoneNumberId = criarJson.id;

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    await supabaseAdmin.from("whatsapp_numeros").upsert(
      {
        user_id: context.userId,
        waba_id: data.wabaId,
        phone_number_id: phoneNumberId,
        display_phone_number: `+${data.ddi} ${data.numero}`,
        verified_name: data.nomeExibicao,
        status: "pendente",
      },
      { onConflict: "phone_number_id" }
    );

    const codigoRes = await fetch(`${GRAPH}/${phoneNumberId}/request_code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code_method: data.metodo, language: "pt_BR" }),
    });
    if (!codigoRes.ok) {
      throw await erroMeta(codigoRes, "A Meta não conseguiu enviar o código.");
    }

    return { ok: true, phoneNumberId };
  });

/** Reenvia o código de verificação de um número já cadastrado. */
export const reenviarCodigoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumberId: string; metodo: "SMS" | "VOICE" }) => {
    if (!input?.phoneNumberId) throw new Error("Número inválido.");
    return {
      phoneNumberId: input.phoneNumberId,
      metodo: input.metodo === "VOICE" ? ("VOICE" as const) : ("SMS" as const),
    };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: numero } = await supabaseAdmin
      .from("whatsapp_numeros")
      .select("waba_id")
      .eq("phone_number_id", data.phoneNumberId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!numero) throw new Error("Número não encontrado.");
    const token = await tokenDaConta(context.userId, numero.waba_id);

    const res = await fetch(`${GRAPH}/${data.phoneNumberId}/request_code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code_method: data.metodo, language: "pt_BR" }),
    });
    if (!res.ok) throw await erroMeta(res, "A Meta não conseguiu enviar o código.");
    return { ok: true };
  });

/** Confirma o código recebido e ativa o número para envio e recebimento. */
export const confirmarCodigoWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { phoneNumberId: string; codigo: string }) => {
    const codigo = (input?.codigo ?? "").replace(/\D/g, "");
    if (!input?.phoneNumberId) throw new Error("Número inválido.");
    if (codigo.length !== 6) throw new Error("O código tem 6 dígitos.");
    return { phoneNumberId: input.phoneNumberId, codigo };
  })
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: numero } = await supabaseAdmin
      .from("whatsapp_numeros")
      .select("waba_id")
      .eq("phone_number_id", data.phoneNumberId)
      .eq("user_id", context.userId)
      .maybeSingle();
    if (!numero) throw new Error("Número não encontrado.");
    const token = await tokenDaConta(context.userId, numero.waba_id);

    const verificarRes = await fetch(`${GRAPH}/${data.phoneNumberId}/verify_code`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ code: data.codigo }),
    });
    if (!verificarRes.ok) {
      throw await erroMeta(verificarRes, "Código incorreto ou expirado.");
    }

    // PIN de seis dígitos exigido pela Meta para ativar o número.
    const pin = String(Math.floor(100000 + Math.random() * 900000));
    const registrarRes = await fetch(`${GRAPH}/${data.phoneNumberId}/register`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", pin }),
    });
    if (!registrarRes.ok) {
      throw await erroMeta(registrarRes, "Não foi possível ativar o número na Meta.");
    }

    const detalheRes = await fetch(
      `${GRAPH}/${data.phoneNumberId}?fields=display_phone_number,verified_name,code_verification_status`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    const detalhe = (await detalheRes.json().catch(() => ({}))) as {
      display_phone_number?: string;
      verified_name?: string;
    };

    await supabaseAdmin
      .from("whatsapp_numeros")
      .update({
        status: "conectado",
        display_phone_number: detalhe.display_phone_number ?? null,
        verified_name: detalhe.verified_name ?? null,
      })
      .eq("phone_number_id", data.phoneNumberId)
      .eq("user_id", context.userId);

    return { ok: true };
  });

/* ------------------------------ Conversas ------------------------------ */

export const listarConversasWhatsapp = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data, error } = await chatDb
      .from("whatsapp_conversas")
      .select(
        "id, phone_number_id, contato_wa_id, contato_nome, ultima_mensagem, ultima_em, nao_lidas"
      )
      .eq("user_id", context.userId)
      .order("ultima_em", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return (data ?? []) as {
      id: string;
      phone_number_id: string;
      contato_wa_id: string;
      contato_nome: string | null;
      ultima_mensagem: string | null;
      ultima_em: string;
      nao_lidas: number;
    }[];
  });

export const listarMensagensWhatsapp = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { conversaId: string }) => {
    if (!input?.conversaId) throw new Error("Conversa inválida.");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");
    const { data: mensagens, error } = await chatDb
      .from("whatsapp_mensagens")
      .select("id, direcao, texto, tipo, status, criado_em")
      .eq("conversa_id", data.conversaId)
      .eq("user_id", context.userId)
      .order("criado_em", { ascending: true })
      .limit(300);
    if (error) throw new Error(error.message);

    await chatDb
      .from("whatsapp_conversas")
      .update({ nao_lidas: 0 })
      .eq("id", data.conversaId)
      .eq("user_id", context.userId);

    return (mensagens ?? []) as {
      id: string;
      direcao: string;
      texto: string | null;
      tipo: string;
      status: string | null;
      criado_em: string;
    }[];
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
    const { chatDb } = await import("@/integrations/supabase/chat-db.server");

    const { data: conversa, error: conversaError } = await chatDb
      .from("whatsapp_conversas")
      .select("id, phone_number_id, contato_wa_id")
      .eq("id", data.conversaId)
      .eq("user_id", context.userId)
      .maybeSingle<{ id: string; phone_number_id: string; contato_wa_id: string }>();
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

    await chatDb.from("whatsapp_mensagens").insert({
      conversa_id: conversa.id,
      user_id: context.userId,
      wa_message_id: envioJson.messages?.[0]?.id ?? null,
      direcao: "saida",
      tipo: "text",
      texto: data.texto,
      status: "enviada",
    });

    await chatDb
      .from("whatsapp_conversas")
      .update({ ultima_mensagem: data.texto, ultima_em: new Date().toISOString() })
      .eq("id", conversa.id);



    return { ok: true };
  });
