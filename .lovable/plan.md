# Rodízio de números nas campanhas

Sim, dá para fazer — mas com um detalhe importante: a API de campanhas aceita **um número por campanha**. Então o rodízio é feito dividindo os contatos entre os números escolhidos e criando uma campanha por número, agrupadas visualmente como uma só.

## Como vai funcionar

1. No formulário de nova campanha, a seleção de "Número de origem" vira multi-seleção (checkboxes com os números disponíveis).
2. Se você marcar 1 número, nada muda (comportamento atual).
3. Se marcar 2 ou mais, aparece a opção de distribuição:
   - **Alternado (round-robin)** — contato 1 → número A, contato 2 → número B, contato 3 → número A...
   - **Em blocos** — divide a lista em partes iguais por número.
4. Ao confirmar, o sistema cria uma campanha por número, nomeadas `Nome da campanha (1/3)`, `(2/3)`, etc., todas com a mesma assistente e o mesmo agendamento.
5. Um resumo antes de enviar mostra quantos contatos vão para cada número.

## Na listagem

- Campanhas do mesmo lote aparecem agrupadas em um card único, com contadores somados (agendadas, em andamento, encerradas) e um selo "Rodízio · N números".
- Encerrar ou excluir o grupo age em todas as partes de uma vez, com confirmação.

## Detalhes técnicos

- `src/lib/vapi.functions.ts`: nova server fn `createVapiCampaignBatch` que recebe `phoneNumberIds[]` + estratégia, faz o split e chama `POST /campaign` sequencialmente (com tolerância a falha parcial: retorna quais criaram e quais falharam). `createVapiCampaign` atual permanece.
- `src/routes/_authenticated/campanhas.tsx`: estado `phoneNumberIds: string[]` + `rotationMode`, UI de multi-seleção e preview de distribuição; agrupamento na listagem por prefixo de nome do lote.
- Erros continuam traduzidos via `translateError`.

## Limitação

O rodízio é por contato no momento da criação (a distribuição é fixa). Não é um rodízio dinâmico "se o número A for bloqueado, usa o B" — isso a API da Vapi não expõe.
