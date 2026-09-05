namespace RelatorioToggl.Relatorios;

public class ResultadoBuscaDescricao
{
    public required List<LinhaBusca> Linhas { get; init; }

    public required long TotalGeralSegundos { get; init; }
}