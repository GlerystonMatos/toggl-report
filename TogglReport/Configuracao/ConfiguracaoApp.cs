namespace RelatorioToggl.Configuracao;

/// <summary>Conteúdo persistido no config.ini.</summary>
public class ConfiguracaoApp
{
    public string? DataInicioAnterior { get; set; }

    public string? DataFimAnterior { get; set; }

    /// <summary>"descricao", "tag" ou "ambos".</summary>
    public string AgrupamentoPadrao { get; set; } = "ambos";

    /// <summary>Tags que ficam de fora da listagem "Por tag" (as demais aparecem lá com a tag e o total).</summary>
    public List<string> TagsDetalhadas { get; set; } = new();

    public List<ConfiguracaoUsuario> Usuarios { get; set; } = new();
}