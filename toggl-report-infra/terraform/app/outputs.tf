output "artifact_registry_repository" {
  value = google_artifact_registry_repository.main.name
}

output "frontend_url" {
  value = google_cloud_run_v2_service.frontend.uri
}

output "backend_url" {
  value = google_cloud_run_v2_service.backend.uri
}

output "cloud_build_deployer_email" {
  value = google_service_account.cloud_build_deployer.email
}

output "cloud_build_trigger_id" {
  value = google_cloudbuild_trigger.deploy.trigger_id
}
