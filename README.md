# GustaLab Console

Frontend standalone para provisionamento de infraestrutura, conectado ao backend do [Backstage](https://backstage.io/).

## Pré-requisitos

- Node.js 18+
- Backstage rodando localmente na porta `7007`

## Como subir

```bash
npm install
npm run dev
```

Acesse em: [http://localhost:5173](http://localhost:5173)

> O Backstage precisa estar rodando em `http://localhost:7007` para as chamadas de API funcionarem.

## Configuração

Todas as variáveis de ambiente ficam no `.env` na raiz do projeto:

```env
VITE_BACKSTAGE_URL=http://localhost:7007  # URL do backend do Backstage
```

Todas as rotas da API do Backstage estão centralizadas em `src/api/backstage.ts`.

## Como os templates são filtrados por provedor

O console usa o id do provedor (ex: `aws`) para filtrar templates diretamente do Backstage Catalog. A lógica em ordem de prioridade:

1. Templates que possuem a tag igual ao id do provedor
2. Fallback: templates cujo nome começa com `{provider}-`

Para que um template apareça no console, ele precisa seguir essa convenção no `template.yaml`:

```yaml
metadata:
  name: aws-sqs-queue
  tags: [aws, sqs, terraform]
```

A responsabilidade de classificar o template pelo provedor correto é de quem escreve o `template.yaml`.

## Outros comandos

```bash
npm run build    # gera build de produção
npm run preview  # visualiza o build de produção localmente
```
