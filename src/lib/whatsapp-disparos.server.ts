// Lógica de envio de campanhas e lembretes do WhatsApp (uso exclusivo no servidor).
const GRAPH = "https://graph.facebook.com/v26.0";

export type HeaderMidia = { tipo: "image" | "video" | "document"; link: string } | null;

export type ComponentesCampanha = {
  header?: HeaderMidia;
  headerTexto?: string[];
  colunas?: string[]; // nomes das colunas do CSV usadas em cada variável do corpo
  recorrencia?: "unico" | "diario" | "semanal" | "mensal";
};

/** Próxima data de um lembrete recorrente, sempre no futuro. */
function proximaData(atual: string, recorrencia: string) {
  const d = new Date(atual);
  const agora = Date.now();
  do {
    if (recorrencia === "diario") d.setDate(d.getDate() + 1);
    else if (recorrencia === "semanal") d.setDate(d.getDate() + 7);
    else d.setMonth(d.getMonth() + 1);
  } while (d.getTime() <= agora);
  return d.toISOString();
}

export type EnvioResultado = { ok: true; waMessageId: string | null } | { ok: false; erro: string };

/** Descobre o token da Meta para um número do usuário. */
export async function tokenDoNumero(userId: string, phoneNumberId: string) {
  const { chatDb: supabaseAdmin } = await import("@/integrations/supabase/chat-db.server");
  const { data: numero } = await supabaseAdmin
    .from("whatsapp_numeros")
    .select("waba_id")
    .eq("phone_number_id", phoneNumberId)
    .eq("user_id", userId)
    .maybeSingle();
  if (!numero) throw new Error("Número não está mais conectado.");
  const { data: conta } = await supabaseAdmin
    .from("whatsapp_accounts")
    .select("access_token")
    .eq("user_id", userId)
    .eq("waba_id", numero.waba_id)
    .maybeSingle();
  if (!conta?.access_token) {
    throw new Error("A autorização da Meta expirou. Conecte o WhatsApp novamente.");
  }
  return { token: conta.access_token, wabaId: numero.waba_id as string };
}

function montarComponentes(componentes: ComponentesCampanha, variaveis: string[]) {
  const lista: Record<string, unknown>[] = [];
  const header = componentes.header;
  if (header?.link) {
    lista.push({
      type: "header",
      parameters: [{ type: header.tipo, [header.tipo]: { link: header.link } }],
    });
  } else if (componentes.headerTexto?.length) {
    lista.push({
      type: "header",
      parameters: componentes.headerTexto.map((texto) => ({ type: "text", text: texto })),
    });
  }
  if (variaveis.length > 0) {
    lista.push({
      type: "body",
      parameters: variaveis.map((valor) => ({ type: "text", text: valor || "-" })),
    });
  }
  return lista;
}

/** Envia uma mensagem de template para um contato. */
export async function enviarTemplate(params: {
  token: string;
  phoneNumberId: string;
  telefone: string;
  templateName: string;
  templateLang: string;
  componentes: ComponentesCampanha;
  variaveis: string[];
}): Promise<EnvioResultado> {
  const body = {
    messaging_product: "whatsapp",
    to: params.telefone,
    type: "template",
    template: {
      name: params.templateName,
      language: { code: params.templateLang },
      components: montarComponentes(params.componentes, params.variaveis),
    },
  };
  const res = await fetch(`${GRAPH}/${params.phoneNumberId}/messages`, {
    method: "POST",
    headers: { Authorization: `Bearer ${params.token}`, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await res.json()) as {
    messages?: { id: string }[];
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    const codigo = json.error?.code ? ` (código ${json.error.code})` : "";
    return { ok: false, erro: `${json.error?.message ?? "A Meta recusou o envio."}${codigo}` };
  }
  return { ok: true, waMessageId: json.messages?.[0]?.id ?? null };
}

/** Registra o envio no histórico de conversas, para a resposta cair no chat. */
export async function registrarNoChat(params: {
  userId: string;
  phoneNumberId: string;
  telefone: string;
  nome: string | null;
  texto: string;
  waMessageId: string | null;
}) {
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  try {
    const { data: existente } = await chatDb
      .from("whatsapp_conversas")
      .select("id")
      .eq("user_id", params.userId)
      .eq("phone_number_id", params.phoneNumberId)
      .eq("contato_wa_id", params.telefone)
      .maybeSingle<{ id: string }>();

    let conversaId = existente?.id ?? null;
    const agora = new Date().toISOString();
    if (conversaId) {
      await chatDb
        .from("whatsapp_conversas")
        .update({ ultima_mensagem: params.texto, ultima_em: agora })
        .eq("id", conversaId);
    } else {
      const { data: criada } = await chatDb
        .from("whatsapp_conversas")
        .insert({
          user_id: params.userId,
          phone_number_id: params.phoneNumberId,
          contato_wa_id: params.telefone,
          contato_nome: params.nome,
          ultima_mensagem: params.texto,
          ultima_em: agora,
          nao_lidas: 0,
        })
        .select("id")
        .maybeSingle<{ id: string }>();
      conversaId = criada?.id ?? null;
    }
    if (!conversaId) return;
    await chatDb.from("whatsapp_mensagens").insert({
      conversa_id: conversaId,
      user_id: params.userId,
      wa_message_id: params.waMessageId,
      direcao: "saida",
      tipo: "template",
      texto: params.texto,
      status: "enviada",
    });
  } catch {
    // histórico é complementar: falha aqui não interrompe o disparo
  }
}

const espera = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Envia os contatos pendentes de uma campanha (em lotes, para respeitar limites da Meta). */
export async function processarCampanha(campanhaId: string, limite = 50) {
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  const { data: campanha } = await chatDb
    .from("whatsapp_campanhas")
    .select(
      "id, user_id, nome, phone_number_id, template_name, template_lang, componentes, enviados, falhas, total",
    )
    .eq("id", campanhaId)
    .maybeSingle<{
      id: string;
      user_id: string;
      nome: string;
      phone_number_id: string;
      template_name: string;
      template_lang: string;
      componentes: ComponentesCampanha | null;
      enviados: number;
      falhas: number;
      total: number;
    }>();
  if (!campanha) return { enviados: 0, falhas: 0, restantes: 0 };

  await chatDb.from("whatsapp_campanhas").update({ status: "enviando" }).eq("id", campanha.id);

  let token: string;
  try {
    ({ token } = await tokenDoNumero(campanha.user_id, campanha.phone_number_id));
  } catch (erro) {
    await chatDb
      .from("whatsapp_campanhas")
      .update({ status: "falhou", erro: (erro as Error).message })
      .eq("id", campanha.id);
    return { enviados: 0, falhas: 0, restantes: 0 };
  }

  const { data: contatos } = await chatDb
    .from("whatsapp_campanha_contatos")
    .select("id, nome, telefone, variaveis")
    .eq("campanha_id", campanha.id)
    .eq("status", "pendente")
    .order("created_at", { ascending: true })
    .limit(limite);

  let enviados = 0;
  let falhas = 0;
  for (const contato of (contatos ?? []) as {
    id: string;
    nome: string | null;
    telefone: string;
    variaveis: string[] | null;
  }[]) {
    const resultado = await enviarTemplate({
      token,
      phoneNumberId: campanha.phone_number_id,
      telefone: contato.telefone,
      templateName: campanha.template_name,
      templateLang: campanha.template_lang,
      componentes: campanha.componentes ?? {},
      variaveis: contato.variaveis ?? [],
    });
    if (resultado.ok) {
      enviados += 1;
      await chatDb
        .from("whatsapp_campanha_contatos")
        .update({
          status: "enviado",
          wa_message_id: resultado.waMessageId,
          erro: null,
          enviado_em: new Date().toISOString(),
        })
        .eq("id", contato.id);
      await registrarNoChat({
        userId: campanha.user_id,
        phoneNumberId: campanha.phone_number_id,
        telefone: contato.telefone,
        nome: contato.nome,
        texto: `[modelo ${campanha.template_name}]`,
        waMessageId: resultado.waMessageId,
      });
    } else {
      falhas += 1;
      await chatDb
        .from("whatsapp_campanha_contatos")
        .update({ status: "falhou", erro: resultado.erro })
        .eq("id", contato.id);
    }
    await espera(350);
  }

  const { count: restantes } = await chatDb
    .from("whatsapp_campanha_contatos")
    .select("id", { count: "exact", head: true })
    .eq("campanha_id", campanha.id)
    .eq("status", "pendente");

  await chatDb
    .from("whatsapp_campanhas")
    .update({
      enviados: (campanha.enviados ?? 0) + enviados,
      falhas: (campanha.falhas ?? 0) + falhas,
      status: (restantes ?? 0) > 0 ? "enviando" : "concluida",
    })
    .eq("id", campanha.id);

  return { enviados, falhas, restantes: restantes ?? 0 };
}

/** Envia um lembrete agendado. */
export async function processarLembrete(lembreteId: string) {
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  const { data: lembrete } = await chatDb
    .from("whatsapp_lembretes")
    .select(
      "id, user_id, nome, telefone, phone_number_id, template_name, template_lang, componentes, variaveis, agendado_para",
    )
    .eq("id", lembreteId)
    .maybeSingle<{
      id: string;
      user_id: string;
      nome: string | null;
      telefone: string;
      phone_number_id: string;
      template_name: string;
      template_lang: string;
      componentes: ComponentesCampanha | null;
      variaveis: string[] | null;
      agendado_para: string;
    }>();
  if (!lembrete) return;
  const recorrencia = lembrete.componentes?.recorrencia ?? "unico";

  try {
    const { token } = await tokenDoNumero(lembrete.user_id, lembrete.phone_number_id);
    const resultado = await enviarTemplate({
      token,
      phoneNumberId: lembrete.phone_number_id,
      telefone: lembrete.telefone,
      templateName: lembrete.template_name,
      templateLang: lembrete.template_lang,
      componentes: lembrete.componentes ?? {},
      variaveis: lembrete.variaveis ?? [],
    });
    if (resultado.ok) {
      await chatDb
        .from("whatsapp_lembretes")
        .update({
          status: recorrencia === "unico" ? "enviado" : "agendado",
          erro: null,
          wa_message_id: resultado.waMessageId,
          enviado_em: new Date().toISOString(),
          ...(recorrencia === "unico"
            ? {}
            : { agendado_para: proximaData(lembrete.agendado_para, recorrencia) }),
        })
        .eq("id", lembrete.id);
      await registrarNoChat({
        userId: lembrete.user_id,
        phoneNumberId: lembrete.phone_number_id,
        telefone: lembrete.telefone,
        nome: lembrete.nome,
        texto: `[modelo ${lembrete.template_name}]`,
        waMessageId: resultado.waMessageId,
      });
    } else {
      await chatDb
        .from("whatsapp_lembretes")
        .update({ status: "falhou", erro: resultado.erro })
        .eq("id", lembrete.id);
    }
  } catch (erro) {
    await chatDb
      .from("whatsapp_lembretes")
      .update({ status: "falhou", erro: (erro as Error).message })
      .eq("id", lembrete.id);
  }
}

/** Roda tudo o que está vencido (campanhas agendadas/em andamento e lembretes). */
export async function processarPendentes() {
  const { chatDb } = await import("@/integrations/supabase/chat-db.server");
  const agora = new Date().toISOString();

  const { data: campanhas } = await chatDb
    .from("whatsapp_campanhas")
    .select("id, status, agendada_para")
    .in("status", ["agendada", "enviando"])
    .limit(10);

  let campanhasProcessadas = 0;
  for (const campanha of (campanhas ?? []) as {
    id: string;
    status: string;
    agendada_para: string | null;
  }[]) {
    if (campanha.status === "agendada" && campanha.agendada_para && campanha.agendada_para > agora) {
      continue;
    }
    await processarCampanha(campanha.id);
    campanhasProcessadas += 1;
  }

  const { data: lembretes } = await chatDb
    .from("whatsapp_lembretes")
    .select("id")
    .eq("status", "agendado")
    .lte("agendado_para", agora)
    .limit(30);

  for (const lembrete of (lembretes ?? []) as { id: string }[]) {
    await processarLembrete(lembrete.id);
  }

  return { campanhas: campanhasProcessadas, lembretes: (lembretes ?? []).length };
}
