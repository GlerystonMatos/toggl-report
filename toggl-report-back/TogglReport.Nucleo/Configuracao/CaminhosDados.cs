namespace RelatorioToggl.Configuracao;

public static class CaminhosDados
{
    private const string NomePasta = "dados";

    private const string NomeArquivoConfiguracao = "TogglRelatorioParametros.ini";

    private const string NomeArquivoConfiguracaoAntigo = "TogglReport.ini";

    private const string NomeArquivoUsuarios = "TogglUsuarios.ini";

    private const string NomeArquivoSprints = "TogglSprints.ini";

    private const string NomeArquivoCategoriasSprint = "TogglSprintCategorias.ini";

    private const string NomeArquivoCacheSprint = "TogglSprintData.ini";

    private const string NomeArquivoCache = "TogglRelatorioData.ini";

    private const string NomeArquivoCacheAntigo = "ToggleData.ini";

    private const string NomeArquivoParametrosGant = "TogglGantParametros.ini";

    private const string NomeArquivoParametrosGantAntigo = "ToggleGantParametros.ini";

    private const string NomeArquivoCacheGant = "TogglGantData.ini";

    private const string NomeArquivoCacheGantAntigo = "ToggleGantData.ini";

    public static string PastaDados(string diretorioBase) => Path.Combine(diretorioBase, NomePasta);

    public static string CaminhoConfiguracao(string diretorioBase) =>
        CaminhoComMigracao(diretorioBase, NomeArquivoConfiguracao, NomeArquivoConfiguracaoAntigo);

    public static string CaminhoUsuarios(string diretorioBase) =>
        Path.Combine(PastaDados(diretorioBase), NomeArquivoUsuarios);

    public static string CaminhoSprints(string diretorioBase) =>
        Path.Combine(PastaDados(diretorioBase), NomeArquivoSprints);

    public static string CaminhoCategoriasSprint(string diretorioBase) =>
        Path.Combine(PastaDados(diretorioBase), NomeArquivoCategoriasSprint);

    public static string CaminhoCacheSprint(string diretorioBase) =>
        Path.Combine(PastaDados(diretorioBase), NomeArquivoCacheSprint);

    public static string CaminhoCache(string diretorioBase) =>
        CaminhoComMigracao(diretorioBase, NomeArquivoCache, NomeArquivoCacheAntigo);

    public static string CaminhoParametrosGant(string diretorioBase) =>
        CaminhoComMigracao(diretorioBase, NomeArquivoParametrosGant, NomeArquivoParametrosGantAntigo);

    public static string CaminhoCacheGant(string diretorioBase) =>
        CaminhoComMigracao(diretorioBase, NomeArquivoCacheGant, NomeArquivoCacheGantAntigo);

    private static string CaminhoComMigracao(string diretorioBase, string nomeArquivoNovo, string nomeArquivoAntigo)
    {
        string pasta = PastaDados(diretorioBase);
        string caminhoNovo = Path.Combine(pasta, nomeArquivoNovo);
        string caminhoAntigo = Path.Combine(pasta, nomeArquivoAntigo);

        if (!File.Exists(caminhoNovo) && File.Exists(caminhoAntigo))
        {
            try
            {
                File.Move(caminhoAntigo, caminhoNovo);
            }
            catch (Exception excecao) when (excecao is IOException or UnauthorizedAccessException)
            {
            }
        }

        return caminhoNovo;
    }
}