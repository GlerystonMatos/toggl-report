locals {
  app_apis = [
    "run.googleapis.com",
    "cloudbuild.googleapis.com",
    "artifactregistry.googleapis.com",
    "iam.googleapis.com",
    # Usada por baixo dos panos pela conexão Cloud Build 2ª geração com o
    # GitHub (guarda o token de autorização OAuth).
    "secretmanager.googleapis.com",
  ]
}

resource "google_project_service" "app" {
  for_each = toset(local.app_apis)

  project = var.app_project_id
  service = each.value

  # Não desabilita a API se o recurso for destruído — mesmo raciocínio do
  # terraform/finops.
  disable_on_destroy = false
}
