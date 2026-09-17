using System.Text.Json;
using System.Text.Json.Serialization;

namespace RelatorioToggl.Jira;

internal sealed class CamposIssueBrutaJira
{
    public NomeObjetoJiraBruto? Priority { get; set; }

    public StatusBrutoJira? Status { get; set; }

    [JsonExtensionData]
    public Dictionary<string, JsonElement>? CamposExtras { get; set; }
}