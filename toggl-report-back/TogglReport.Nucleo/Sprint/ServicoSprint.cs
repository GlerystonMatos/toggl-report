using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;
using System.Globalization;
using System.Text.RegularExpressions;

namespace RelatorioToggl.Sprints;

public static class ServicoSprint
{
    private static readonly Regex PadraoCodigo = new(@"^(TEL - \d+)(?: - (.+))?$", RegexOptions.Compiled);

    public static ResultadoSprint Montar(
        Sprint sprint,
        List<ConfiguracaoUsuario> usuariosSelecionados,
        ResultadoConsulta consulta,
        ConfiguracaoCategoriasSprint categorias)
    {
        int diasUteis = ContarDiasUteis(sprint.DataInicio, sprint.DataFim);

        decimal tempoTotal = sprint.HorasPorDia * diasUteis;
        int margem = (int)Math.Floor(0.30m * tempoTotal);
        int tdPorColaborador = (int)Math.Floor(tempoTotal - margem);
        int ct = tdPorColaborador * usuariosSelecionados.Count;

        List<List<string>> listasCategoria = new() { categorias.Dev, categorias.Rev, categorias.Qa };

        HashSet<string> nomesSelecionados = usuariosSelecionados.Select(u => u.NomeExibicao).ToHashSet();
        Dictionary<string, int> indicePorNome = new();
        for (int i = 0; i < usuariosSelecionados.Count; i++)
            indicePorNome[usuariosSelecionados[i].NomeExibicao] = i;

        HashSet<string> colaboradoresComQa = new();
        foreach ((string nomeExibicao, List<RegistroTempoDto> registros) in consulta.RegistrosPorUsuario)
        {
            if (!nomesSelecionados.Contains(nomeExibicao))
                continue;

            foreach (RegistroTempoDto registro in registros)
            {
                if (registro.Duracao < 0)
                    continue;

                bool temTagQa = registro.Tags is { Count: > 0 }
                    && registro.Tags.Any(tag => categorias.Qa.Contains(tag, StringComparer.OrdinalIgnoreCase));

                if (temTagQa)
                {
                    colaboradoresComQa.Add(nomeExibicao);
                    break;
                }
            }
        }

        Dictionary<(string Chave, string NomeExibicao, bool Agrupada), long[]> segundosPorChave = new();
        Dictionary<string, long> segundosRealizadosPorUsuario = new();

        foreach ((string nomeExibicao, List<RegistroTempoDto> registros) in consulta.RegistrosPorUsuario)
        {
            if (!nomesSelecionados.Contains(nomeExibicao))
                continue;

            foreach (RegistroTempoDto registro in registros)
            {
                if (registro.Duracao < 0)
                    continue;

                segundosRealizadosPorUsuario.TryGetValue(nomeExibicao, out long realizadoAcumulado);
                segundosRealizadosPorUsuario[nomeExibicao] = realizadoAcumulado + registro.Duracao;

                (string chave, bool agrupada) = ChaveAgrupamento(registro, categorias);

                (string Chave, string NomeExibicao, bool Agrupada) chaveInterna = (chave, nomeExibicao, agrupada);
                if (!segundosPorChave.TryGetValue(chaveInterna, out long[]? segundos))
                {
                    segundos = new long[3];
                    segundosPorChave[chaveInterna] = segundos;
                }

                if (agrupada)
                {
                    int bucket = colaboradoresComQa.Contains(nomeExibicao) ? 2 : 0;
                    segundos[bucket] += registro.Duracao;
                }
                else
                {
                    for (int categoria = 0; categoria < 3; categoria++)
                    {
                        bool tagNaCategoria = registro.Tags is { Count: > 0 }
                            && registro.Tags.Any(tag => listasCategoria[categoria].Contains(tag, StringComparer.OrdinalIgnoreCase));

                        if (tagNaCategoria)
                            segundos[categoria] += registro.Duracao;
                    }
                }
            }
        }

        Dictionary<string, ConfiguracaoUsuario> usuarioPorNome = usuariosSelecionados.ToDictionary(u => u.NomeExibicao);

        Dictionary<(string Chave, bool Agrupada), List<(string NomeExibicao, long[] Segundos)>> porGrupo = new();
        foreach (KeyValuePair<(string Chave, string NomeExibicao, bool Agrupada), long[]> par in segundosPorChave)
        {
            (string Chave, bool Agrupada) chaveGrupo = (par.Key.Chave, par.Key.Agrupada);
            if (!porGrupo.TryGetValue(chaveGrupo, out List<(string NomeExibicao, long[] Segundos)>? colaboradoresDoGrupo))
            {
                colaboradoresDoGrupo = new List<(string NomeExibicao, long[] Segundos)>();
                porGrupo[chaveGrupo] = colaboradoresDoGrupo;
            }

            colaboradoresDoGrupo.Add((par.Key.NomeExibicao, par.Value));
        }

        List<LinhaTarefaSprint> tarefas = new();

        foreach (KeyValuePair<(string Chave, bool Agrupada), List<(string NomeExibicao, long[] Segundos)>> grupo in porGrupo)
        {
            (string chave, bool agrupada) = grupo.Key;

            List<(string NomeExibicao, long[] Segundos)> colaboradoresOrdenados = grupo.Value
                .OrderBy(c => indicePorNome[c.NomeExibicao])
                .ToList();

            List<SlotColaborador[]> linhasEmConstrucao = new();

            foreach ((string nomeExibicao, long[] segundos) in colaboradoresOrdenados)
            {
                List<int> categoriasUsadas = new();
                for (int categoria = 0; categoria < 3; categoria++)
                {
                    if (segundos[categoria] > 0)
                        categoriasUsadas.Add(categoria);
                }

                if (categoriasUsadas.Count == 0)
                {
                    linhasEmConstrucao.Add(new SlotColaborador[3]);
                    continue;
                }

                ConfiguracaoUsuario usuario = usuarioPorNome[nomeExibicao];
                SlotColaborador[]? linhaCompativel = linhasEmConstrucao
                    .FirstOrDefault(linha => categoriasUsadas.All(categoria => linha[categoria].NomeExibicao is null));

                if (linhaCompativel is null)
                {
                    linhaCompativel = new SlotColaborador[3];
                    linhasEmConstrucao.Add(linhaCompativel);
                }

                foreach (int categoria in categoriasUsadas)
                    linhaCompativel[categoria] = new SlotColaborador(usuario.NomeExibicao, usuario.Sigla, usuario.Cor, segundos[categoria]);
            }

            string codigo;
            string descricao;
            if (agrupada)
            {
                codigo = "";
                descricao = chave;
            }
            else
            {
                (codigo, descricao) = SepararCodigo(chave);
            }

            foreach (SlotColaborador[] linha in linhasEmConstrucao)
            {
                tarefas.Add(new LinhaTarefaSprint(
                    codigo,
                    descricao,
                    agrupada,
                    CriarBloco(linha[0]),
                    CriarBloco(linha[1]),
                    CriarBloco(linha[2])));
            }
        }

        int MenorIndiceColaborador(LinhaTarefaSprint linha)
        {
            int menor = int.MaxValue;
            foreach (BlocoCategoriaSprint bloco in new[] { linha.Dev, linha.Rev, linha.Qa })
            {
                if (bloco.NomeExibicao is not null)
                    menor = Math.Min(menor, indicePorNome[bloco.NomeExibicao]);
            }

            return menor;
        }

        List<LinhaTarefaSprint> tarefasOrdenadas = tarefas
            .OrderBy(t => t.Agrupada)
            .ThenBy(t => t.Agrupada || !string.IsNullOrEmpty(t.Codigo) ? 0 : 1)
            .ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))
            .ThenBy(t => t.Agrupada ? "" : t.Codigo, StringComparer.OrdinalIgnoreCase)
            .ThenBy(t => t.Agrupada ? MenorIndiceColaborador(t) : 0)
            .ThenBy(t => t.Descricao, StringComparer.OrdinalIgnoreCase)
            .ToList();

        int descricoesDistintas = segundosPorChave.Keys
            .Where(k => !k.Agrupada)
            .Select(k => k.Chave)
            .Distinct()
            .Count();

        CabecalhoSprint cabecalho = new(
            sprint.Nome,
            sprint.HorasPorDia,
            diasUteis,
            margem,
            sprint.DataInicio,
            sprint.DataFim,
            ct,
            tdPorColaborador,
            descricoesDistintas,
            0);

        List<LinhaColaboradorSprint> colaboradores = new();

        foreach (ConfiguracaoUsuario usuario in usuariosSelecionados)
        {
            segundosRealizadosPorUsuario.TryGetValue(usuario.NomeExibicao, out long segundosRealizados);

            int pendentesColaborador = segundosPorChave.Keys
                .Where(k => !k.Agrupada && k.NomeExibicao == usuario.NomeExibicao)
                .Select(k => k.Chave)
                .Distinct()
                .Count();

            colaboradores.Add(new LinhaColaboradorSprint(
                usuario.NomeExibicao,
                usuario.Sigla,
                usuario.Cor,
                tdPorColaborador,
                segundosRealizados,
                pendentesColaborador,
                0));
        }

        return new ResultadoSprint(cabecalho, tarefasOrdenadas, colaboradores);
    }

    private static (string Chave, bool Agrupada) ChaveAgrupamento(RegistroTempoDto registro, ConfiguracaoCategoriasSprint categorias)
    {
        string tagPrincipal = registro.Tags is { Count: > 0 } ? registro.Tags[0] : "(sem tag)";

        bool detalharPorDescricao = categorias.Agrupamento switch
        {
            "descricao" => true,
            "tag" => false,
            _ => categorias.TagsDetalhadas.Contains(tagPrincipal, StringComparer.OrdinalIgnoreCase),
        };

        return detalharPorDescricao
            ? (ServicoAgrupamento.NormalizarDescricaoTel((registro.Descricao ?? "").Trim()), false)
            : (tagPrincipal, true);
    }

    private static (string Codigo, string Descricao) SepararCodigo(string chave)
    {
        Match correspondencia = PadraoCodigo.Match(chave);
        if (!correspondencia.Success)
            return ("", chave);

        return (correspondencia.Groups[1].Value, correspondencia.Groups[2].Success ? correspondencia.Groups[2].Value : "");
    }

    private static int NumeroCodigo(string codigo)
    {
        string digitos = new(codigo.Where(char.IsDigit).ToArray());
        return int.TryParse(digitos, out int numero) ? numero : int.MaxValue;
    }

    private static int ContarDiasUteis(string dataInicio, string dataFim)
    {
        DateTime inicio = DateTime.ParseExact(dataInicio, "yyyy-MM-dd", CultureInfo.InvariantCulture);
        DateTime fim = DateTime.ParseExact(dataFim, "yyyy-MM-dd", CultureInfo.InvariantCulture);

        return DiasUteis.Entre(inicio, fim).Count();
    }

    private static BlocoCategoriaSprint CriarBloco(SlotColaborador slot) =>
        new(0m, slot.Segundos, slot.NomeExibicao, slot.Sigla, slot.Cor);

    private readonly record struct SlotColaborador(string? NomeExibicao, string? Sigla, string? Cor, long Segundos);
}