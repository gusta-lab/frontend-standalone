# sqs-${{ values.name }}

Fila SQS Standard gerenciada por Terraform — ambiente `${{ values.environment }}`.

## Uso

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
