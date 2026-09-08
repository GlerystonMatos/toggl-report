namespace RelatorioToggl.Configuracao;

public class ConfiguracaoCategoriasSprint
{
    public List<string> Dev { get; set; } = new();

    public List<string> Rev { get; set; } = new();

    public List<string> Qa { get; set; } = new();

    public string Agrupamento { get; set; } = "ambos";

    public List<string> TagsDetalhadas { get; set; } = new();
}