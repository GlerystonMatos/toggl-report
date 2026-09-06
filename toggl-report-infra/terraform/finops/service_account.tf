data "google_project" "finops" {
  project_id = var.finops_project_id
}

# Necessário desde a mudança de comportamento padrão do Cloud Build (2024):
# quem efetivamente RODA o build da function (não a identidade de runtime
# dela, configurada abaixo) passou a ser a conta padrão do Compute Engine
# em projetos novos — e essa conta não vem mais com permissão de builder
# por padrão. Google documenta especificamente para deploy de Cloud
# Functions: https://cloud.google.com/build/docs/securing-builds/configure-access-for-cloud-build-service-account
resource "google_project_iam_member" "build_default_compute_run_builder" {
  project = var.finops_project_id
  role    = "roles/run.builder"
  member  = "serviceAccount:${data.google_project.finops.number}-compute@developer.gserviceaccount.com"
}

resource "google_service_account" "killswitch" {
  project      = var.finops_project_id
  account_id   = "billing-killswitch"
  display_name = "Billing killswitch (desabilita billing do app ao estourar orçamento)"

  depends_on = [google_project_service.finops]
}

# Permissão mínima para conseguir desabilitar o billing do projeto de app —
# concedida no nível da BILLING ACCOUNT, não do projeto (é onde a Cloud
# Billing API verifica essa permissão). Quem rodar "terraform apply" precisa
# já ter permissão de administrar essa billing account (ex.: Billing Account
# Administrator ou Owner) — o Terraform não se autoconcede esse acesso.
resource "google_billing_account_iam_member" "killswitch_billing_admin" {
  billing_account_id = var.billing_account_id
  role               = "roles/billing.admin"
  member             = "serviceAccount:${google_service_account.killswitch.email}"
}

# Permissões para o Eventarc entregar as mensagens do tópico Pub/Sub à
# function (exigidas para o event_trigger de uma Cloud Run Function 2ª
# geração com service_account_email customizada).
resource "google_project_iam_member" "killswitch_eventarc_receiver" {
  project = var.finops_project_id
  role    = "roles/eventarc.eventReceiver"
  member  = "serviceAccount:${google_service_account.killswitch.email}"
}

resource "google_project_iam_member" "killswitch_run_invoker" {
  project = var.finops_project_id
  role    = "roles/run.invoker"
  member  = "serviceAccount:${google_service_account.killswitch.email}"
}
