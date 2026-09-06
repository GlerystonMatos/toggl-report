# Imagem placeholder pública do próprio Google — o Cloud Build (cloudbuild.yaml)
# substitui pela imagem real a cada deploy via "gcloud run deploy --image=...".
# "lifecycle.ignore_changes" evita que um "terraform apply" reverta a imagem
# de produção de volta pro placeholder.
locals {
  placeholder_image = "us-docker.pkg.dev/cloudrun/container/hello"
}

resource "google_cloud_run_v2_service" "backend" {
  project  = var.app_project_id
  name     = var.backend_service_name
  location = var.region

  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = var.backend_container_port
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [google_project_service.app]
}

resource "google_cloud_run_v2_service" "frontend" {
  project  = var.app_project_id
  name     = var.frontend_service_name
  location = var.region

  deletion_protection = false

  template {
    scaling {
      min_instance_count = 0
      max_instance_count = 1
    }

    containers {
      image = local.placeholder_image

      ports {
        container_port = var.frontend_container_port
      }
    }
  }

  lifecycle {
    ignore_changes = [template[0].containers[0].image]
  }

  depends_on = [google_project_service.app]
}

# Api "sem autenticação, uso local/produção simples" (decisão já tomada fora
# desta tarefa) e o frontend é uma SPA pública consumida direto pelo
# navegador do usuário — os dois precisam aceitar chamada não autenticada.
resource "google_cloud_run_v2_service_iam_member" "backend_public" {
  project  = var.app_project_id
  location = var.region
  name     = google_cloud_run_v2_service.backend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

resource "google_cloud_run_v2_service_iam_member" "frontend_public" {
  project  = var.app_project_id
  location = var.region
  name     = google_cloud_run_v2_service.frontend.name
  role     = "roles/run.invoker"
  member   = "allUsers"
}
