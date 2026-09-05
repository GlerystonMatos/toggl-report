using System.Text.Json.Serialization;

namespace RelatorioToggl.Toggl;

/// <summary>Campos relevantes de uma time entry de GET /api/v9/me/time_entries.</summary>
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

    /// <summary>Segundos. Valor negativo indica timer ainda em execução.</summary>
    [JsonPropertyName("duration")]
    public long Duracao { get; set; }

    /// <summary>Nomes das tags, já resolvidos pela API.</summary>
    [JsonPropertyName("tags")]
    public List<string>? Tags { get; set; }

    [JsonPropertyName("start")]
    public DateTimeOffset? Inicio { get; set; }

    [JsonPropertyName("stop")]
    public DateTimeOffset? Fim { get; set; }
}