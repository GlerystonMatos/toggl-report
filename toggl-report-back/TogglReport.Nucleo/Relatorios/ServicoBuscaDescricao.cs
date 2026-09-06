using RelatorioToggl.Toggl;

namespace RelatorioToggl.Relatorios;

public static class ServicoBuscaDescricao
{
    private const string RotuloSemDescricao = "(sem descrição)";

    public static ResultadoBuscaDescricao Buscar(List<string> ordemUsuarios, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario, string termoBusca)
    {
        Dictionary<string, Dictionary<string, long>> linhas = new(StringComparer.OrdinalIgnoreCase);

        foreach (string usuario in ordemUsuarios)
        {
            if (!registrosPorUsuario.TryGetValue(usuario, out List<RegistroTempoDto>? registros))
                continue;

            foreach (RegistroTempoDto registro in ServicoAgrupamento.ObterConcluidos(registros))
            {
                string descricao = string.IsNullOrWhiteSpace(registro.Descricao)
                    ? RotuloSemDescricao
                    : registro.Descricao.Trim();

                if (!descricao.Contains(termoBusca, StringComparison.OrdinalIgnoreCase))
                    continue;

                if (!linhas.TryGetValue(descricao, out Dictionary<string, long>? porUsuario))
                {
                    porUsuario = new Dictionary<string, long>();
                    linhas[descricao] = porUsuario;
                }

                porUsuario[usuario] = porUsuario.GetValueOrDefault(usuario) + registro.Duracao;
            }
        }

        List<LinhaBusca> listaLinhas = linhas
            .Select(par => new LinhaBusca(par.Key, par.Value, par.Value.Values.Sum()))
            .OrderByDescending(l => l.TotalSegundosLinha)
            .ThenBy(l => l.Descricao, StringComparer.OrdinalIgnoreCase)
            .ToList();

        return new ResultadoBuscaDescricao
        {
            Linhas = listaLinhas,
            TotalGeralSegundos = listaLinhas.Sum(l => l.TotalSegundosLinha)
        };
    }
}