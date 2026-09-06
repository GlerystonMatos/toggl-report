data "google_project" "app" {
  project_id = var.app_project_id
}

resource "google_service_account" "cloud_build_deployer" {
  project      = var.app_project_id
  account_id   = "cloud-build-deployer"
  display_name = "Cloud Build deployer (build + push + deploy Cloud Run)"

  depends_on = [google_project_service.app]
}

# As duas permissões pedidas explicitamente.
resource "google_project_iam_member" "deployer_artifact_registry_writer" {
  project = var.app_project_id
  role    = "roles/artifactregistry.writer"
  member  = "serviceAccount:${google_service_account.cloud_build_deployer.email}"
}

resource "google_project_iam_member" "deployer_cloud_run_developer" {
  project = var.app_project_id
  role    = "roles/run.developer"
  member  = "serviceAccount:${google_service_account.cloud_build_deployer.email}"
}

# Não pedido explicitamente, mas obrigatório: qualquer trigger do Cloud
# Build com service account customizada (em vez da conta padrão do Cloud
# Build) precisa desse role, senão o build falha ao gravar logs.
resource "google_project_iam_member" "deployer_log_writer" {
  project = var.app_project_id
  role    = "roles/logging.logWriter"
  member  = "serviceAccount:${google_service_account.cloud_build_deployer.email}"
}

# Também obrigatório: os serviços Cloud Run (cloud-run.tf) não têm service
# account de runtime dedicada — rodam com a conta padrão do Compute Engine
# (mais simples, sem duas SAs extras não pedidas). Para o deployer conseguir
# fazer "gcloud run deploy", ele precisa "agir como" essa conta.
resource "google_service_account_iam_member" "deployer_act_as_default_compute" {
  service_account_id = "projects/${var.app_project_id}/serviceAccounts/${data.google_project.app.number}-compute@developer.gserviceaccount.com"
  role               = "roles/iam.serviceAccountUser"
  member             = "serviceAccount:${google_service_account.cloud_build_deployer.email}"
}
