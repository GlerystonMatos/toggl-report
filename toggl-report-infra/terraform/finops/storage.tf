# Bucket dedicado só ao .zip de deploy da Cloud Run Function abaixo.
# google_cloudfunctions2_function exige "storage_source" (GCS) — não há
# alternativa de source inline/Git nesse recurso do Terraform (confirmado
# antes de criar este arquivo). Escopo mínimo por decisão explícita: nenhum
# outro uso de Cloud Storage neste projeto.
resource "google_storage_bucket" "function_source" {
  name     = "${var.finops_project_id}-killswitch-source"
  project  = var.finops_project_id
  location = var.region

  uniform_bucket_level_access = true
  force_destroy               = true

  depends_on = [google_project_service.finops]
}

data "archive_file" "function_source" {
  type        = "zip"
  source_dir  = "${path.module}/function-src"
  output_path = "${path.module}/.build/killswitch-source.zip"
}

resource "google_storage_bucket_object" "function_source" {
  name   = "killswitch-source-${data.archive_file.function_source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.function_source.output_path
}
