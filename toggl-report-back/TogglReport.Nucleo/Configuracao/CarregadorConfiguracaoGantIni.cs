using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorConfiguracaoGantIni
{
    private const string SecaoGeral = "Geral";

    public static ConfiguracaoGant? Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            return null;

        Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);
        ConfiguracaoGant configuracao = new();

        if (secoes.TryGetValue(SecaoGeral, out Dictionary<string, string>? geral))
        {
            configuracao.DataInicio = AnalisadorIni.ObterOuNulo(geral, "DataInicio");
            configuracao.DataFim = AnalisadorIni.ObterOuNulo(geral, "DataFim");
            configuracao.TagsSelecionadas = AnalisadorIni.DividirLista(AnalisadorIni.ObterOuPadrao(geral, "TagsSelecionadas", ""));
            configuracao.Agrupamento = AnalisadorIni.ObterOuPadrao(geral, "Agrupamento", "ambos");
        }

        return configuracao;
    }

    public static void Salvar(string caminho, ConfiguracaoGant configuracao)
    {
        StringBuilder sb = new();

        sb.AppendLine($"[{SecaoGeral}]");
        sb.AppendLine($"DataInicio={configuracao.DataInicio}");
        sb.AppendLine($"DataFim={configuracao.DataFim}");
        sb.AppendLine($"TagsSelecionadas={string.Join(",", configuracao.TagsSelecionadas)}");
        sb.AppendLine($"Agrupamento={configuracao.Agrupamento}");

        AnalisadorIni.Escrever(caminho, sb.ToString());
    }
}