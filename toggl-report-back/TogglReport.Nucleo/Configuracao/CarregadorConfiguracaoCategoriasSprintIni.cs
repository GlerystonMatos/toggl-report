using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorConfiguracaoCategoriasSprintIni
{
    private const string SecaoGeral = "Geral";

    public static ConfiguracaoCategoriasSprint Padrao() => new()
    {
        Dev = new List<string>(),
        Rev = new List<string>(),
        Qa = new List<string>(),
        Agrupamento = "ambos",
        TagsDetalhadas = new List<string>()
    };

    public static ConfiguracaoCategoriasSprint Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            return Padrao();

        Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);
        ConfiguracaoCategoriasSprint padrao = Padrao();

        if (!secoes.TryGetValue(SecaoGeral, out Dictionary<string, string>? geral))
            return padrao;

        return new ConfiguracaoCategoriasSprint
        {
            Dev = LerLista(geral, "Dev", padrao.Dev),
            Rev = LerLista(geral, "Rev", padrao.Rev),
            Qa = LerLista(geral, "Qa", padrao.Qa),
            Agrupamento = AnalisadorIni.ObterOuPadrao(geral, "Agrupamento", padrao.Agrupamento),
            TagsDetalhadas = LerLista(geral, "TagsDetalhadas", padrao.TagsDetalhadas)
        };
    }

    public static void Salvar(string caminho, ConfiguracaoCategoriasSprint configuracao)
    {
        StringBuilder sb = new();

        sb.AppendLine($"[{SecaoGeral}]");
        sb.AppendLine($"Dev={string.Join(",", configuracao.Dev)}");
        sb.AppendLine($"Rev={string.Join(",", configuracao.Rev)}");
        sb.AppendLine($"Qa={string.Join(",", configuracao.Qa)}");
        sb.AppendLine($"Agrupamento={configuracao.Agrupamento}");
        sb.AppendLine($"TagsDetalhadas={string.Join(",", configuracao.TagsDetalhadas)}");

        AnalisadorIni.Escrever(caminho, sb.ToString());
    }

    private static List<string> LerLista(Dictionary<string, string> secao, string chave, List<string> valorPadrao)
    {
        string? valor = AnalisadorIni.ObterOuNulo(secao, chave);
        return valor is null ? valorPadrao : AnalisadorIni.DividirLista(valor);
    }
}