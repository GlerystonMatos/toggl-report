# A conexão em si é criada manualmente via "gcloud builds connections create
# github" — exige autorização OAuth/GitHub App interativa, que o Terraform
# não consegue automatizar (ver README, passo 4). Declarada aqui só para o
# Terraform poder referenciá-la (via "terraform import", depois de criada
# manualmente) — "ignore_changes" evita que o Terraform tente sobrescrever
# a configuração de autorização que ele não gerencia.
resource "google_cloudbuildv2_connection" "github" {
  project  = var.app_project_id
  location = var.region
  name     = var.github_connection_name

  lifecycle {
    ignore_changes = [github_config]
  }
}

resource "google_cloudbuildv2_repository" "app" {
  project           = var.app_project_id
  location          = var.region
  name              = var.github_repo
  parent_connection = google_cloudbuildv2_connection.github.name
  remote_uri        = "https://github.com/${var.github_owner}/${var.github_repo}.git"
}

resource "google_cloudbuild_trigger" "deploy" {
  project     = var.app_project_id
  name        = "deploy-producao"
  description = "Build + push + deploy de frontend e backend ao dar push na branch deploy"
  location    = var.region

  repository_event_config {
    repository = google_cloudbuildv2_repository.app.id

    push {
      branch = var.deploy_branch_regex
    }
  }

  filename = var.cloudbuild_config_path

  substitutions = {
    _REGION           = var.region
    _REPOSITORY       = google_artifact_registry_repository.main.repository_id
    _FRONTEND_SERVICE = var.frontend_service_name
    _BACKEND_SERVICE  = var.backend_service_name
  }

  service_account = google_service_account.cloud_build_deployer.id

  depends_on = [
    google_project_service.app,
    google_project_iam_member.deployer_log_writer,
  ]
}
