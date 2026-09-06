output "budget_notification_topic" {
  description = "Nome completo do tópico Pub/Sub — usar em --notifications-rule-pubsub-topic ao criar o Budget manualmente (ver README, passo manual)."
  value       = google_pubsub_topic.budget_notifications.id
}

output "killswitch_service_account_email" {
  description = "E-mail da service account do killswitch — só para conferência/auditoria."
  value       = google_service_account.killswitch.email
}

output "killswitch_function_name" {
  value = google_cloudfunctions2_function.killswitch.name
}
