using System.Text.Json.Serialization;

namespace RelatorioToggl.Toggl;

public class RegistroTempoDto
{
    [JsonPropertyName("id")]
    public long Id { get; set; }

    [JsonPropertyName("workspace_id")]
    public long IdWorkspace { get; set; }

    [JsonPropertyName("project_id")]
    public long? IdProjeto { get; set; }

    [JsonPropertyName("description")]
    public string? Descricao { get; set; }

    [JsonPropertyName("duration")]
    public long Duracao { get; set; }

    [JsonPropertyName("tags")]
    public List<string>? Tags { get; set; }

    [JsonPropertyName("start")]
    public DateTimeOffset? Inicio { get; set; }

    [JsonPropertyName("stop")]
    public DateTimeOffset? Fim { get; set; }
}