resource "google_artifact_registry_repository" "main" {
  project       = var.app_project_id
  location      = var.region
  repository_id = var.artifact_registry_repository_id
  format        = "DOCKER"
  description   = "Imagens Docker do toggl-report (frontend e backend)"

  # Uma policy DELETE sozinha apagaria tudo; uma policy KEEP sozinha não
  # apaga nada (só protege contra uma DELETE) — as duas juntas são
  # necessárias para "manter só as N mais recentes, apagar o resto".
  cleanup_policies {
    id     = "delete-old-versions"
    action = "DELETE"

    condition {
      tag_state = "ANY"
    }
  }

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"

    most_recent_versions {
      keep_count = var.keep_image_count
    }
  }

  depends_on = [google_project_service.app]
}
