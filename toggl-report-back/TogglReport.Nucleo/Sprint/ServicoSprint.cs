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

        List<LinhaTarefaSprint> tarefas = new();

        foreach (KeyValuePair<(string Chave, string NomeExibicao, bool Agrupada), long[]> par in segundosPorChave)
        {
            (string Chave, string NomeExibicao, bool Agrupada) chaveInterna = par.Key;
            long[] segundos = par.Value;

            string codigo;
            string descricao;
            if (chaveInterna.Agrupada)
            {
                codigo = "";
                descricao = chaveInterna.Chave;
            }
            else
            {
                (codigo, descricao) = SepararCodigo(chaveInterna.Chave);
            }

            ConfiguracaoUsuario usuario = usuarioPorNome[chaveInterna.NomeExibicao];

            tarefas.Add(new LinhaTarefaSprint(
                codigo,
                descricao,
                usuario.NomeExibicao,
                usuario.Sigla,
                usuario.Cor,
                chaveInterna.Agrupada,
                new BlocoCategoriaSprint(0m, segundos[0]),
                new BlocoCategoriaSprint(0m, segundos[1]),
                new BlocoCategoriaSprint(0m, segundos[2])));
        }

        List<LinhaTarefaSprint> tarefasOrdenadas = tarefas
            .OrderBy(t => t.Agrupada)
            .ThenBy(t => t.Agrupada || !string.IsNullOrEmpty(t.Codigo) ? 0 : 1)
            .ThenBy(t => t.Agrupada ? 0 : NumeroCodigo(t.Codigo))
            .ThenBy(t => t.Agrupada ? "" : t.Codigo, StringComparer.OrdinalIgnoreCase)
            .ThenBy(t => t.Agrupada ? indicePorNome[t.NomeExibicao] : 0)
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
}