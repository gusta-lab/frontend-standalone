resource "aws_sqs_queue" "this" {
  name = var.queue_name

  tags = {
    Name        = var.queue_name
    Environment = var.environment
    ManagedBy   = "terraform"
  }
}
