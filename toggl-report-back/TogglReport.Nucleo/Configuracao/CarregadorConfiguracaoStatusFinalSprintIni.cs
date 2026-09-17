namespace RelatorioToggl.Configuracao;

public static class CarregadorConfiguracaoStatusFinalSprintIni
{
    private const string SecaoConsolidada = "SprintStatusFinal";

    public static ConfiguracaoStatusFinalSprint Padrao() => new()
    {
        StatusConcluido = new List<string>(),
        StatusIgnorado = new List<string>()
    };

    public static ConfiguracaoStatusFinalSprint Carregar(string caminhoConsolidado)
    {
        if (File.Exists(caminhoConsolidado))
        {
            Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminhoConsolidado);
            if (secoes.TryGetValue(SecaoConsolidada, out Dictionary<string, string>? secao))
                return Mapear(secao);
        }

        return Padrao();
    }

    public static void Salvar(string caminhoConsolidado, ConfiguracaoStatusFinalSprint configuracao)
    {
        Dictionary<string, Dictionary<string, string>> secoes = File.Exists(caminhoConsolidado)
            ? AnalisadorIni.Analisar(caminhoConsolidado)
            : new Dictionary<string, Dictionary<string, string>>(StringComparer.OrdinalIgnoreCase);

        secoes[SecaoConsolidada] = ParaValores(configuracao);

        AnalisadorIni.EscreverSecoes(caminhoConsolidado, secoes);
    }

    private static ConfiguracaoStatusFinalSprint Mapear(Dictionary<string, string> valores)
    {
        ConfiguracaoStatusFinalSprint padrao = Padrao();
        return new ConfiguracaoStatusFinalSprint
        {
            StatusConcluido = LerLista(valores, "StatusConcluido", padrao.StatusConcluido),
            StatusIgnorado = LerLista(valores, "StatusIgnorado", padrao.StatusIgnorado)
        };
    }

    private static Dictionary<string, string> ParaValores(ConfiguracaoStatusFinalSprint configuracao) => new(StringComparer.OrdinalIgnoreCase)
    {
        ["StatusConcluido"] = string.Join(",", configuracao.StatusConcluido),
        ["StatusIgnorado"] = string.Join(",", configuracao.StatusIgnorado)
    };

    private static List<string> LerLista(Dictionary<string, string> secao, string chave, List<string> valorPadrao)
    {
        string? valor = AnalisadorIni.ObterOuNulo(secao, chave);
        return valor is null ? valorPadrao : AnalisadorIni.DividirLista(valor);
    }
}