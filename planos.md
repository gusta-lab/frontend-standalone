# Planos — GustaLab Console

Evolução do portal IDP standalone além do Day 0.

---

## Estado atual

```
Frontend → Backstage Scaffolder → cria repo no Git (com Terraform)
```

O recurso na nuvem **não é criado**. O repo existe, mas o Terraform nunca rodou.

---

## Fechando o Day 0: Git → Cloud

O elo que falta é um runner de Terraform.

**Opção A — GitHub Actions no skeleton (escolhida)**
Adicionar `.github/workflows/apply.yml` dentro de `aws-sqs-queue/skeleton/`. Quando o Backstage cria o repo e faz o push inicial, o workflow já está presente e roda `terraform apply` automaticamente. Sem infraestrutura nova.

**Opção B — Atlantis**
Servidor que ouve PRs no GitHub e roda `plan`/`apply`. Mais robusto para times, mas requer um servidor rodando.

**Opção C — Terraform Cloud/Enterprise**
Workspace por repo, trigger por push. Managed, mas tem custo.

---

## Day 1: Editar o recurso

Padrão GitOps:

```
Frontend lê config atual (repo ou catalog)
  → usuário edita os valores
  → frontend submete para template de "update"
  → Backstage cria PR com terraform.tfvars atualizado
  → GitHub Actions roda terraform plan no PR (review)
  → merge → apply
```

**Implementação:**

1. Criar template `aws-sqs-queue-update` no Backstage
   - Recebe `repoName` + novos valores
   - Usa a action `publish:github:pull-request` do Backstage
   - Cria o PR com o `terraform.tfvars` atualizado

2. No frontend, a tela do recurso existente terá um botão "Editar" que:
   - Lê os valores atuais do `terraform.tfvars` via GitHub API ou via annotations do catalog entity
   - Abre o formulário pré-preenchido (reusa o `TemplatePage` existente)
   - Submete para o template de update em vez do de criação

---

## Day 2: Operar

Tela "Meus recursos" que lê do Backstage Catalog (populado pelo scaffolder no Day 0):

```
GET /api/catalog/entities?filter=kind=Resource,spec.owner=<team>
```

Cada card exibe:
- Status atual (link para o GitHub Actions — última run)
- Outputs do Terraform (via annotations no `catalog-info.yaml`)
- Botão "Editar" → fluxo Day 1
- Botão "Destruir" → template `destroy` que cria PR com `terraform destroy`

---

## Arquitetura completa

```
Day 0  Frontend → template "create"  → repo + GH Actions → terraform apply
Day 1  Frontend → template "update"  → PR com tfvars novo → review → apply
Day 2  Frontend → Catalog API        → lê estado atual, outputs, histórico
       Frontend → template "destroy" → PR com destroy flag → apply
```

O Backstage faz o trabalho pesado (criar repo, criar PR, registrar no catalog). O frontend nunca fala com o GitHub diretamente — tudo passa pelo Backstage como backend.

---

## Backlog

| Peça | Onde vive | Prioridade |
|------|-----------|------------|
| `.github/workflows/apply.yml` no skeleton | `aws-sqs-queue/skeleton/` | Alta |
| Template `aws-sqs-queue-update` | Novo `template.yaml` no Backstage | Alta |
| Tela "Meus recursos" no frontend | `src/pages/ResourcesPage.tsx` | Média |
| Lógica de pré-preenchimento do formulário de edição | `TemplatePage` + state | Média |
| Template `aws-sqs-queue-destroy` | Novo `template.yaml` no Backstage | Baixa |

**Maior desafio técnico:** Day 1 — ler o estado atual do `terraform.tfvars` do repo para pré-preencher o formulário. Pode vir da GitHub API (`GET /repos/{owner}/{repo}/contents/terraform.tfvars`) ou de annotations no catalog entity populadas no Day 0.
