# Diagnóstico do erro de conexão do WhatsApp

## Objetivo
Identificar por que a Meta recusa o ativo `1598469858330013` no Cadastro Incorporado e corrigir somente o ponto responsável.

## Evidências já confirmadas
- O app está publicado e o cadastro usa a configuração `1204149271864892`.
- `whatsapp_business_management` e `whatsapp_business_messaging` têm acesso avançado.
- A integração como Provedor de Tecnologia aparece concluída.
- A pessoa que testa possui controle total na conta WhatsApp conhecida.
- O ID recusado `1598469858330013` não corresponde à conta WhatsApp conferida nem aparece nos ativos verificados pelo cliente.
- O erro acontece dentro da janela da Meta, antes de o Omniasyn receber o código de autorização; portanto, ainda não há falha de gravação no painel.

## Plano
1. **Identificar o ativo recusado**
   - Conferir, na conta do cliente, os IDs em **Configurações do negócio → Informações do negócio**, **Contas do WhatsApp**, **Páginas**, **Contas de anúncios** e **Apps conectados**.
   - Conferir também o ID da conta WhatsApp e do portfólio exibidos no **WhatsApp Manager**.
   - Comparar todos com `1598469858330013` para descobrir se é um ativo antigo, compartilhado ou pertencente a outro portfólio.

2. **Auditar a configuração “Chat” completa**
   - Solicitar uma imagem inteira da configuração `1204149271864892`, mostrando **Produtos**, **Ativos**, **Permissões**, **Tipo de token**, versão e opções avançadas.
   - Confirmar que somente **WhatsApp Cloud API**, **Contas do WhatsApp**, `whatsapp_business_management` e `whatsapp_business_messaging` estão sendo solicitados.
   - Remover qualquer produto ou ativo adicional somente se a tela comprovar que ele está selecionado.

3. **Eliminar autorizações antigas**
   - Conferir se há uma instalação anterior do Ominisyn na conta cliente e removê-la antes de novo teste.
   - Repetir o cadastro em janela anônima, escolhendo explicitamente o portfólio correto.

4. **Capturar o diagnóstico do fluxo**
   - Se a Meta continuar recusando antes de concluir, registrar no painel Omniasyn os eventos de sessão `WA_EMBEDDED_SIGNUP`, incluindo etapa, evento e IDs não sensíveis.
   - Exibir uma mensagem de diagnóstico em português, preservando o código da Meta e o ID do ativo recusado.
   - Não registrar tokens, códigos de autorização ou credenciais.

5. **Validar a integração após a autorização**
   - Confirmar que o retorno contém WABA ID e Phone Number ID.
   - Validar a troca do código, a assinatura do app na conta WhatsApp e a listagem do número antes de salvar.
   - Tratar e mostrar qualquer erro devolvido pela Meta nessas etapas, em vez de continuar silenciosamente.

## O que preciso receber primeiro
Envie duas imagens, sem cortar a lateral direita:

1. **Meta for Developers → Ominisyn → Login do Facebook para Empresas → Configurações → abrir “Chat”**: imagem mostrando Produtos, Ativos, Permissões, tipo de token e versão.
2. **WhatsApp Manager do cliente → Configurações → Contas do WhatsApp → abrir a conta usada no teste**: imagem mostrando o nome, o ID da conta WhatsApp e o portfólio proprietário.

Com essas imagens, será possível decidir se a correção é na configuração da Meta ou se precisamos adicionar o diagnóstico no painel.
