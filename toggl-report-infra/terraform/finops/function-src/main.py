import os

import functions_framework
from google.cloud import billing_v1


@functions_framework.cloud_event
def disable_billing(cloud_event):
    """Desabilita o billing do projeto de app ao chegar qualquer mensagem no
    tópico Pub/Sub configurado como event_trigger.

    Não inspeciona o conteúdo da mensagem (custo/threshold) — o tópico só
    recebe notificações do budget alert criado manualmente para o projeto de
    app (ver README), então qualquer mensagem já significa "o orçamento
    estourou". Isso segue o padrão oficial documentado pelo Google em
    https://cloud.google.com/billing/docs/how-to/disable-billing-with-notifications
    """
    project_id = os.environ["APP_PROJECT_ID"]
    project_name = f"projects/{project_id}"

    client = billing_v1.CloudBillingClient()
    billing_info = client.get_project_billing_info(name=project_name)

    if not billing_info.billing_enabled:
        print(f"Billing já estava desabilitado em {project_id}; nada a fazer.")
        return

    client.update_project_billing_info(
        name=project_name,
        project_billing_info=billing_v1.ProjectBillingInfo(billing_account_name=""),
    )
    print(f"Billing desabilitado em {project_id}.")
