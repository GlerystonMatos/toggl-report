using RelatorioToggl.Toggl;
using System.Text.RegularExpressions;

namespace RelatorioToggl.Relatorios;

public static class ServicoAgrupamento
{
    private const string RotuloSemDescricao = "(sem descrição)";

    private const string RotuloSemTag = "(sem tag)";

    private static readonly Regex RegexTel = new(@"^TEL\s*-?\s*(\d+)\s*-?\s*(.*)$", RegexOptions.IgnoreCase | RegexOptions.Compiled);

    public static string NormalizarDescricaoTel(string descricao)
    {
        Match m = RegexTel.Match(descricao);
        if (!m.Success)
            return descricao;

        string numero = m.Groups[1].Value;
        string resto = m.Groups[2].Value.Trim();
        return resto.Length == 0 ? $"TEL - {numero}" : $"TEL - {numero} - {resto}";
    }

    private static string ChaveDescricao(string? descricaoBruta) =>
        string.IsNullOrWhiteSpace(descricaoBruta) ? RotuloSemDescricao : NormalizarDescricaoTel(descricaoBruta.Trim());

    public static List<RegistroTempoDto> ObterConcluidos(List<RegistroTempoDto> registros)
        => registros.Where(r => r.Duracao >= 0).ToList();

    public static List<RegistroTempoDto> ObterEmAndamento(List<RegistroTempoDto> registros)
        => registros.Where(r => r.Duracao < 0).ToList();

    public static List<LinhaDescricao> AgruparPorDescricaoComTag(List<RegistroTempoDto> registros)
    {
        Dictionary<string, (long Segundos, string? Tag)> grupos = new();

        foreach (RegistroTempoDto registro in ObterConcluidos(registros))
        {
            string chave = ChaveDescricao(registro.Descricao);
            string? tag = registro.Tags is { Count: > 0 } ? registro.Tags[0] : null;

            (long Segundos, string? Tag) atual = grupos.GetValueOrDefault(chave, (0L, null));
            grupos[chave] = (atual.Segundos + registro.Duracao, atual.Tag ?? tag);
        }

        return grupos.Select(kv => new LinhaDescricao(kv.Key, kv.Value.Segundos, kv.Value.Tag)).ToList();
    }

    public static List<LinhaDescricao> AgruparPorDescricaoComTag(List<RegistroTempoDto> registros, List<string> tagsDetalhadas)
    {
        Dictionary<string, (long Segundos, string? Tag)> grupos = new();

        foreach (RegistroTempoDto registro in ObterConcluidos(registros))
        {
            string? tagQueBate = registro.Tags?.FirstOrDefault(t => tagsDetalhadas.Contains(t, StringComparer.OrdinalIgnoreCase));
            if (tagQueBate is null)
                continue;

            string chave = ChaveDescricao(registro.Descricao);
            (long Segundos, string? Tag) atual = grupos.GetValueOrDefault(chave, (0L, null));
            grupos[chave] = (atual.Segundos + registro.Duracao, atual.Tag ?? tagQueBate);
        }

        return grupos.Select(kv => new LinhaDescricao(kv.Key, kv.Value.Segundos, kv.Value.Tag)).ToList();
    }

    public static Dictionary<string, long> AgruparPorTag(List<RegistroTempoDto> registros)
    {
        Dictionary<string, long> grupos = new(StringComparer.OrdinalIgnoreCase);

        foreach (RegistroTempoDto registro in ObterConcluidos(registros))
        {
            if (registro.Tags == null || registro.Tags.Count == 0)
            {
                grupos[RotuloSemTag] = grupos.GetValueOrDefault(RotuloSemTag) + registro.Duracao;
                continue;
            }

            foreach (string tag in registro.Tags)
                grupos[tag] = grupos.GetValueOrDefault(tag) + registro.Duracao;
        }

        return grupos;
    }

    public static List<KeyValuePair<string, long>> AgruparPorTagFiltrada(List<RegistroTempoDto> registros, List<string> tagsDetalhadas)
        => AgruparPorTag(registros)
            .Where(par => !tagsDetalhadas.Contains(par.Key, StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(par => par.Value)
            .ToList();

    public static long ObterTotalSegundos(List<RegistroTempoDto> registros)
        => ObterConcluidos(registros).Sum(r => r.Duracao);
}