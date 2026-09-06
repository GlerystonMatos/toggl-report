namespace RelatorioToggl.Configuracao;

public class ConfiguracaoApp
{
    public string? DataInicioAnterior { get; set; }

    public string? DataFimAnterior { get; set; }

    public string AgrupamentoPadrao { get; set; } = "ambos";

    public List<string> TagsDetalhadas { get; set; } = new();

    public List<ConfiguracaoUsuario> Usuarios { get; set; } = new();
}