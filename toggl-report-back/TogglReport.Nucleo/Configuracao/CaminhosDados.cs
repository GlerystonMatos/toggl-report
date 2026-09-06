namespace RelatorioToggl.Configuracao;

public static class CaminhosDados
{
    private const string NomePasta = "dados";

    private const string NomeArquivoConfiguracao = "TogglReport.ini";

    private const string NomeArquivoCache = "ToggleData.ini";

    private const string NomeArquivoParametrosGant = "ToggleGantParametros.ini";

    private const string NomeArquivoCacheGant = "ToggleGantData.ini";

    public static string PastaDados(string diretorioBase) => Path.Combine(diretorioBase, NomePasta);

    public static string CaminhoConfiguracao(string diretorioBase) => Path.Combine(PastaDados(diretorioBase), NomeArquivoConfiguracao);

    public static string CaminhoCache(string diretorioBase) => Path.Combine(PastaDados(diretorioBase), NomeArquivoCache);

    public static string CaminhoParametrosGant(string diretorioBase) => Path.Combine(PastaDados(diretorioBase), NomeArquivoParametrosGant);

    public static string CaminhoCacheGant(string diretorioBase) => Path.Combine(PastaDados(diretorioBase), NomeArquivoCacheGant);
}