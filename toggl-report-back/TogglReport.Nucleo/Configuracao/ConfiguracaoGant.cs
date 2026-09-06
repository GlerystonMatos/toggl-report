namespace RelatorioToggl.Configuracao;

public class ConfiguracaoGant
{
    public string? DataInicio { get; set; }

    public string? DataFim { get; set; }

    public List<string> TagsSelecionadas { get; set; } = new();

    public string Agrupamento { get; set; } = "ambos";
}