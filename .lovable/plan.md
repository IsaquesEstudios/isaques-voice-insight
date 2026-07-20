## Plano

1. **Trocar o método de salvamento**
   - Parar de tentar salvar os campos apenas dentro de `analysisPlan.structuredDataMultiPlan`.
   - Usar o fluxo oficial da Vapi para Structured Outputs: `POST /structured-output` e `PATCH /structured-output/{id}`.
   - Vincular cada Structured Output ao assistente com `assistantIds: [assistantId]`, para aparecer no painel da Vapi em **Analysis / Structured Outputs** e funcionar na extração pós-ligação.

2. **Manter compatibilidade com campos já existentes**
   - Continuar lendo os formatos já suportados: `analysisPlan.structuredDataPlan`, `analysisPlan.structuredDataMultiPlan` e Structured Outputs reutilizáveis.
   - Ajustar a leitura para priorizar os Structured Outputs oficiais vinculados ao assistente, preservando `id`, `name`, `type` e `description`.

3. **Atualizar sem duplicar**
   - Quando o usuário salvar um campo que já existe na Vapi, atualizar o Structured Output existente em vez de criar outro duplicado.
   - Quando criar um campo novo, criar um Structured Output oficial do tipo `ai` com schema simples do campo.
   - Se um campo for removido da interface, desvincular/remover da lista vinculada ao assistente conforme a API permitir, evitando que continue ativo sem aparecer na plataforma.

4. **Melhorar retorno de erro**
   - Mostrar mensagens claras quando a Vapi recusar o payload, incluindo o motivo real retornado pela API.
   - Após salvar, recarregar os dados direto da Vapi para confirmar que o que aparece na tela é o que está salvo lá.

## Detalhes técnicos

- Arquivo principal: `src/lib/vapi.functions.ts`.
- Ajustar `StructuredSchemaField` para carregar também o `id` do Structured Output quando existir.
- Criar helpers internos para montar o payload oficial:

```ts
{
  name: field.name,
  type: "ai",
  description: field.description,
  schema: {
    type: "object",
    properties: {
      [field.name]: {
        type: field.type,
        description: field.description
      }
    },
    required: [field.name]
  },
  assistantIds: [assistantId]
}
```

- Ajustar `src/routes/_authenticated/assistants.$id.tsx` apenas se necessário para preservar o `id` dos campos carregados e reenviar no save.