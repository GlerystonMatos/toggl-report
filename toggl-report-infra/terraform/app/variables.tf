variable "app_project_id" {
  description = "ID do projeto GCP principal (Cloud Run, Cloud Build, Artifact Registry)."
  type        = string
}

variable "region" {
  description = "Região GCP para Cloud Run, Artifact Registry e Cloud Build. Confirmar disponibilidade/custo na documentação oficial atual antes de fixar em produção."
  type        = string
  default     = "us-central1"
}

variable "artifact_registry_repository_id" {
  description = "ID do repositório Docker no Artifact Registry (guarda as imagens de frontend e backend)."
  type        = string
  default     = "toggl-report"
}

variable "keep_image_count" {
  description = "Quantas versões mais recentes manter no Artifact Registry antes de apagar as demais (cleanup policy)."
  type        = number
  default     = 2
}

variable "frontend_service_name" {
  description = "Nome do serviço Cloud Run do frontend."
  type        = string
  default     = "toggl-report-front"
}

variable "backend_service_name" {
  description = "Nome do serviço Cloud Run do backend."
  type        = string
  default     = "toggl-report-back"
}

variable "frontend_container_port" {
  description = "Porta que o container do frontend expõe (nginx)."
  type        = number
  default     = 8080
}

variable "backend_container_port" {
  description = "Porta que o container do backend expõe (Kestrel)."
  type        = number
  default     = 8080
}

variable "github_owner" {
  description = "Dono do repositório GitHub conectado ao Cloud Build."
  type        = string
  default     = "GlerystonMatos"
}

variable "github_repo" {
  description = "Nome do repositório GitHub conectado ao Cloud Build."
  type        = string
  default     = "toggl-report"
}

variable "github_connection_name" {
  description = "Nome da conexão Cloud Build 2ª geração com o GitHub (criada manualmente via 'gcloud builds connections create github' — ver README, passo 4). O Terraform só referencia, não cria (a autorização OAuth é manual)."
  type        = string
  default     = "github-connection"
}

variable "deploy_branch_regex" {
  description = "Regex de branch que dispara o trigger de deploy (Cloud Build aceita só regex, não nome exato)."
  type        = string
  default     = "^deploy$"
}

variable "cloudbuild_config_path" {
  description = "Caminho do cloudbuild.yaml dentro do repositório."
  type        = string
  default     = "toggl-report-infra/cloudbuild.yaml"
}
