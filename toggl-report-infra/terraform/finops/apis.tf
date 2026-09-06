locals {
  finops_apis = [
    "cloudbilling.googleapis.com",
    "cloudfunctions.googleapis.com",
    "cloudbuild.googleapis.com",
    "eventarc.googleapis.com",
    "run.googleapis.com",
    "pubsub.googleapis.com",
    "artifactregistry.googleapis.com",
    "storage.googleapis.com",
    "iam.googleapis.com",
  ]
}

resource "google_project_service" "finops" {
  for_each = toset(local.finops_apis)

  project = var.finops_project_id
  service = each.value

  # Não desabilita a API se o recurso for destruído — evitar quebrar o
  # projeto finops por um "terraform destroy" acidental num recurso qualquer.
  disable_on_destroy = false
}
