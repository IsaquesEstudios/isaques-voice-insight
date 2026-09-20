# WhatsApp: conversas no banco externo

## O que está acontecendo

Sua mensagem chegou: o texto "Hd" foi recebido às 17:35 e gravado — só que no banco interno do aplicativo, não no seu banco externo.

Motivo: a versão que está no ar em app.omniasyn.com (para onde a Meta entrega as mensagens) ainda é a antiga, que grava no banco interno. A tela nova de conversas lê do banco externo, que está criado e vazio. Por isso a mensagem existe, mas não aparece.

## O que será feito

1. Publicar a versão atual para que o endereço que recebe as mensagens passe a gravar no seu banco externo.
2. Copiar a conversa e a mensagem já recebidas do banco interno para o externo, para nada se perder.
3. Conferir, depois de publicado, se uma nova mensagem enviada ao +55 11 95503-0426 aparece na tela em tempo real.
4. Se algo falhar ao gravar, registrar o motivo no log do servidor em vez de ignorar em silêncio, para diagnóstico rápido.

## Detalhes técnicos

- `src/routes/api/public/webhooks/whatsapp.ts` já usa `chatDb` (banco externo via `MY_SUPABASE_URL` / `MY_SUPABASE_SERVICE_ROLE_KEY`); a resolução do `user_id` continua pelo `whatsapp_numeros` do banco interno.
- Verificado: as tabelas `whatsapp_conversas` e `whatsapp_mensagens` existem no banco externo e respondem 200, ambas vazias.
- Verificado: no banco interno há 1 conversa (contato 5511983404368, "Hd", 17:35) e 1 mensagem correspondente — evidência de que o webhook publicado ainda escreve lá.
- A cópia dos registros existentes será feita inserindo a conversa e a mensagem no banco externo com os mesmos `user_id`, `phone_number_id`, `wa_message_id` e datas.
- Os erros de `upsert` no webhook passarão a ser logados com `console.error`, sem expor tokens.
- Nenhuma alteração de schema é necessária.
