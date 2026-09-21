# Disparos e Templates no WhatsApp

Duas páginas novas no menu WhatsApp: **Disparos** (campanhas em massa + lembretes agendados) e **Templates** (criação e gestão dos modelos oficiais da Meta).

## Página Templates

Lista todos os templates da conta do cliente buscados direto da Meta, com nome, idioma, **categoria** (Marketing, Utilidade, Autenticação), status (aprovado, em análise, rejeitado) e motivo da rejeição quando houver. Filtro por número/conta e botão de atualizar.

Criação de template com os mesmos campos do painel da Meta:
- Nome (minúsculas e underline), idioma, categoria.
- Cabeçalho opcional: texto (com 1 variável) ou arquivo (imagem, vídeo, documento, localização).
- Corpo obrigatório com variáveis {{1}}, {{2}}... e exemplos para cada variável (a Meta exige exemplos).
- Rodapé opcional.
- Botões opcionais: resposta rápida (até 3), abrir site (estático ou dinâmico), ligar, copiar código.
- Prévia em formato de balão do WhatsApp enquanto se preenche.
- Excluir template.

Validações locais antes de enviar (limites de caracteres, exemplos obrigatórios, quantidade de botões) e mensagens de erro da Meta traduzidas para linguagem simples.

## Página Disparos

Duas abas.

**Campanhas**
- Escolher o número remetente e o template aprovado.
- Subir CSV com nome e número; prévia da lista, contagem de válidos/inválidos, normalização para E.164.
- Mapear colunas do CSV para as variáveis do template.
- Enviar agora ou agendar data e hora.
- Lista de campanhas com progresso (enviados, entregues, falhas) e detalhe contato a contato.

**Lembretes**
- Cadastro de nome, número, escolha do template e data/hora.
- Ao escolher o template, os campos de mensagem aparecem conforme as variáveis dele; se o template tiver cabeçalho de arquivo, aparece o campo de arquivo.
- Lista de lembretes com status (agendado, enviado, falhou) e opção de cancelar/excluir.

Envio respeita o limite da Meta com pequeno intervalo entre mensagens e registra cada resultado. As mensagens enviadas também entram no histórico de conversas, para a resposta do cliente cair no chat normalmente.

## Agendamento

Um endereço interno protegido verifica periodicamente campanhas e lembretes com horário vencido e faz os envios. No banco externo será criado um agendamento automático (a cada minuto) que chama esse endereço — vai junto no SQL que você roda.

## Detalhes técnicos

- Novas tabelas no banco externo (SQL entregue para você rodar no SQL Editor): `whatsapp_campanhas`, `whatsapp_campanha_contatos`, `whatsapp_lembretes`, todas com `user_id`, índices, triggers de `updated_at`, grants para `service_role` e RLS ligado sem políticas públicas.
- Templates não são duplicados no banco: são lidos e escritos direto em `GET/POST/DELETE {waba_id}/message_templates` (Graph v26.0) com o token da conta em `whatsapp_accounts`. Cabeçalhos com arquivo usam o upload retomável (`/{app_id}/uploads`) para obter o `header_handle`.
- Envio usa `POST /{phone_number_id}/messages` com `type: "template"` e os `components` montados a partir das variáveis.
- Novas server functions em `src/lib/whatsapp-templates.functions.ts` e `src/lib/whatsapp-disparos.functions.ts`, com `requireSupabaseAuth` e `chatDb`, seguindo o padrão de `whatsapp.functions.ts` (guarda `tabelaAusente` para avisar quando o SQL ainda não foi rodado).
- Rota de cron em `src/routes/api/public/cron/whatsapp-disparos.ts` protegida por segredo próprio (`DISPAROS_CRON_SECRET`, gerado automaticamente); `pg_cron` + `net.http_post` no banco externo chamam a cada minuto.
- Páginas `src/routes/_authenticated/whatsapp-disparos.tsx` e `src/routes/_authenticated/whatsapp-templates.tsx`, com `head()` próprio e itens adicionados ao grupo WhatsApp em `src/components/app-sidebar.tsx`.
- CSV via `papaparse`, já usado em Campanhas.

## Fora do escopo

Preços em dinheiro por template: a página mostra apenas a categoria e o status, conforme sua escolha.
