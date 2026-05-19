# sqs-${{ values.name }}

${{ values.description or 'Fila SQS gerenciada por Terraform' }}

## Ambiente

**${{ values.environment }}**

## Como provisionar

```bash
terraform init
terraform plan
terraform apply
```

## Outputs

| Output | Descrição |
|--------|-----------|
| `queue_url` | URL para publicar/consumir mensagens |
| `queue_arn` | ARN para uso em políticas IAM |
