resource "google_pubsub_topic" "budget_notifications" {
  name    = var.notification_topic_name
  project = var.finops_project_id

  depends_on = [google_project_service.finops]
}
