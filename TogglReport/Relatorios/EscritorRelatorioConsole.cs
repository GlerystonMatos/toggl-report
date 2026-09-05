using RelatorioToggl.Apresentacao;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Relatorios;

public static class EscritorRelatorioConsole
{
    public const string Indentacao = "     ";

    public const string TituloSecaoDescricao = "   ── Por descrição ── ";

    private const string PrefixoTel = "TEL";

    public static void ImprimirLinha(string indentacao, string texto, long segundos)
    {
        string duracao = FormatarDuracao(segundos);
        int larguraDescricao = Tela.LarguraRestante(indentacao.Length + 1 + duracao.Length);
        Console.WriteLine($"{indentacao}{Tela.Ajustar(texto, larguraDescricao)} {duracao}");
    }

    public static void ImprimirRelatorioUsuario(string nomeExibicao, DateTime de, DateTime ate, string agrupamento, List<RegistroTempoDto> registros, List<string> tagsDetalhadas)
    {
        Console.WriteLine();
        Paleta.EscreverLinha(Tela.LinhaPreenchida($" ═══ {nomeExibicao} ({de:yyyy-MM-dd} a {ate:yyyy-MM-dd}) ", '═'), Paleta.Titulo);

        if (registros.Count == 0)
        {
            Paleta.EscreverLinha("   Nenhuma time entry encontrada no período.", Paleta.Info);
            return;
        }

        if (agrupamento is "descricao" or "ambos")
        {
            List<LinhaDescricao> linhas = agrupamento == "ambos"
                ? ServicoAgrupamento.AgruparPorDescricaoComTag(registros, tagsDetalhadas)
                : ServicoAgrupamento.AgruparPorDescricaoComTag(registros);
            ImprimirSecaoDescricao(linhas);
        }

        if (agrupamento is "tag" or "ambos")
            ImprimirSecaoTag(ServicoAgrupamento.AgruparPorTag(registros), tagsDetalhadas);

        ImprimirEmAndamento(ServicoAgrupamento.ObterEmAndamento(registros));

        long totalSegundos = ServicoAgrupamento.ObterTotalSegundos(registros);
        Paleta.EscreverLinha($"   Total do período (excluindo em andamento): {FormatarDuracao(totalSegundos)}", Paleta.Sucesso);
    }

    private static void ImprimirSecaoDescricao(List<LinhaDescricao> linhas)
    {
        Paleta.EscreverLinha(Tela.LinhaPreenchida(TituloSecaoDescricao, '─'), Paleta.Neutro);

        if (linhas.Count == 0)
        {
            Paleta.EscreverLinha("     (nenhum dado)", Paleta.Info);
            Console.WriteLine();
            return;
        }

        IEnumerable<LinhaDescricao> comTel = linhas
            .Where(l => l.Descricao.StartsWith(PrefixoTel, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(l => l.Segundos);

        IEnumerable<LinhaDescricao> semTel = linhas
            .Where(l => !l.Descricao.StartsWith(PrefixoTel, StringComparison.OrdinalIgnoreCase))
            .OrderByDescending(l => l.Segundos);

        foreach (LinhaDescricao linha in comTel)
            ImprimirLinha(Indentacao, linha.Descricao, linha.Segundos);

        foreach (LinhaDescricao linha in semTel)
            ImprimirLinha(Indentacao, $"({linha.Tag ?? "sem tag"}) {linha.Descricao}", linha.Segundos);

        Console.WriteLine();
    }

    private static void ImprimirSecaoTag(Dictionary<string, long> grupo, List<string> tagsDetalhadas)
    {
        Paleta.EscreverLinha(Tela.LinhaPreenchida("   ── Por tag ── ", '─'), Paleta.Neutro);

        List<KeyValuePair<string, long>> exibidas = grupo
            .Where(par => !tagsDetalhadas.Contains(par.Key, StringComparer.OrdinalIgnoreCase))
            .OrderByDescending(par => par.Value)
            .ToList();

        if (exibidas.Count == 0)
        {
            Paleta.EscreverLinha("     (nenhum dado)", Paleta.Info);
            Console.WriteLine();
            return;
        }

        foreach (KeyValuePair<string, long> par in exibidas)
            ImprimirLinha(Indentacao, par.Key, par.Value);

        Console.WriteLine();
    }

    private static void ImprimirEmAndamento(List<RegistroTempoDto> emAndamento)
    {
        if (emAndamento.Count == 0)
            return;

        Paleta.EscreverLinha(Tela.LinhaPreenchida("   ── Em andamento ── ", '─'), Paleta.Neutro);

        foreach (RegistroTempoDto registro in emAndamento)
        {
            string descricao = string.IsNullOrWhiteSpace(registro.Descricao) ? "(sem descrição)" : ServicoAgrupamento.NormalizarDescricaoTel(registro.Descricao);
            string textoInicio = registro.Inicio?.ToLocalTime().ToString("yyyy-MM-dd HH:mm") ?? "horário desconhecido";
            string sufixo = $" (iniciado às {textoInicio})";
            int larguraDescricao = Tela.LarguraRestante(Indentacao.Length + 2 + sufixo.Length);
            Console.WriteLine($"{Indentacao}\"{Tela.Ajustar(descricao, larguraDescricao)}\"{sufixo}");
        }

        Console.WriteLine();
    }

    public static string FormatarDuracao(long segundos)
    {
        if (segundos < 0)
            segundos = 0;

        TimeSpan duracao = TimeSpan.FromSeconds(segundos);
        return $"{(int)duracao.TotalHours:00}h{duracao.Minutes:00}m{duracao.Seconds:00}s";
    }
}