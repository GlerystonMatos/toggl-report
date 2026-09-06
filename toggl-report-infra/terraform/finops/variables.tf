variable "finops_project_id" {
  description = "ID do projeto GCP dedicado ao killswitch de billing — separado do projeto de app de propósito (ver README)."
  type        = string
}

variable "app_project_id" {
  description = "ID do projeto GCP principal (Cloud Run/Cloud Build/Artifact Registry) que este killswitch protege, desabilitando o billing dele quando o orçamento estourar."
  type        = string
}

variable "billing_account_id" {
  description = "ID da Billing Account (formato XXXXXX-XXXXXX-XXXXXX) já vinculada manualmente aos dois projetos. Necessário para conceder Billing Account Administrator à service account do killswitch — quem rodar apply precisa já ter permissão de administrar essa billing account."
  type        = string
}

variable "region" {
  description = "Região GCP para o tópico Pub/Sub, o bucket de source e a Cloud Run Function. Confirmar disponibilidade/custo na documentação oficial atual antes de fixar em produção."
  type        = string
  default     = "us-central1"
}

variable "function_name" {
  description = "Nome da Cloud Run Function (2ª geração) que desabilita o billing do projeto de app."
  type        = string
  default     = "billing-killswitch"
}

variable "notification_topic_name" {
  description = "Nome do tópico Pub/Sub que recebe as notificações do budget alert (usado ao criar o Budget manualmente — ver README)."
  type        = string
  default     = "budget-notifications"
}
