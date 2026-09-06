resource "google_cloudfunctions2_function" "killswitch" {
  name     = var.function_name
  project  = var.finops_project_id
  location = var.region

  build_config {
    runtime     = "python312"
    entry_point = "disable_billing"

    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.function_source.name
      }
    }
  }

  service_config {
    available_memory      = "256M"
    timeout_seconds       = 60
    max_instance_count    = 1
    min_instance_count    = 0
    service_account_email = google_service_account.killswitch.email

    environment_variables = {
      APP_PROJECT_ID = var.app_project_id
    }
  }

  event_trigger {
    trigger_region        = var.region
    event_type            = "google.cloud.pubsub.topic.v1.messagePublished"
    pubsub_topic          = google_pubsub_topic.budget_notifications.id
    service_account_email = google_service_account.killswitch.email
    retry_policy          = "RETRY_POLICY_DO_NOT_RETRY"
  }

  depends_on = [
    google_project_service.finops,
    google_billing_account_iam_member.killswitch_billing_admin,
    google_project_iam_member.killswitch_eventarc_receiver,
    google_project_iam_member.killswitch_run_invoker,
    google_project_iam_member.build_default_compute_run_builder,
  ]
}
