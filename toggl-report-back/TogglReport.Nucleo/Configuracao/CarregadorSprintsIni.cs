using System.Globalization;
using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorSprintsIni
{
    private const string PrefixoSecaoSprint = "Sprint:";

    public static List<Sprint> Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            return new List<Sprint>();

        Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);
        List<Sprint> sprints = new();

        foreach ((string nomeSecao, Dictionary<string, string> valores) in secoes)
        {
            if (!nomeSecao.StartsWith(PrefixoSecaoSprint, StringComparison.OrdinalIgnoreCase))
                continue;

            string chave = nomeSecao.Substring(PrefixoSecaoSprint.Length);
            sprints.Add(new Sprint
            {
                Chave = chave,
                Nome = AnalisadorIni.ObterOuPadrao(valores, "Nome", chave),
                HorasPorDia = decimal.TryParse(
                    AnalisadorIni.ObterOuPadrao(valores, "HorasPorDia", "0"),
                    NumberStyles.Number,
                    CultureInfo.InvariantCulture,
                    out decimal horasPorDia) ? horasPorDia : 0,
                DataInicio = AnalisadorIni.ObterOuPadrao(valores, "DataInicio", ""),
                DataFim = AnalisadorIni.ObterOuPadrao(valores, "DataFim", "")
            });
        }

        return sprints;
    }

    public static void Salvar(string caminho, List<Sprint> sprints)
    {
        StringBuilder sb = new();

        foreach (Sprint sprint in sprints)
        {
            sb.AppendLine($"[{PrefixoSecaoSprint}{sprint.Chave}]");
            sb.AppendLine($"Nome={sprint.Nome}");
            sb.AppendLine($"HorasPorDia={sprint.HorasPorDia.ToString(CultureInfo.InvariantCulture)}");
            sb.AppendLine($"DataInicio={sprint.DataInicio}");
            sb.AppendLine($"DataFim={sprint.DataFim}");
            sb.AppendLine();
        }

        AnalisadorIni.Escrever(caminho, sb.ToString());
    }
}