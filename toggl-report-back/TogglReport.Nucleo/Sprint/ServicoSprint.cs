using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Jira;
using RelatorioToggl.Relatorios;
using RelatorioToggl.Toggl;
using System.Globalization;
using System.Text.RegularExpressions;

namespace RelatorioToggl.Sprint;

public static class ServicoSprint
{
    private static readonly Regex PadraoCodigo = new(@"^(TEL - \d+)(?: - (.+))?$", RegexOptions.Compiled);
    private static readonly string[] GruposCategoria = { "dev", "rev", "qa" };

    public static List<string> ExtrairCodigosJira(Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario)
    {
        HashSet<string> codigos = new(StringComparer.OrdinalIgnoreCase);

        foreach (List<RegistroTempoDto> registros in registrosPorUsuario.Values)
        {
            foreach (RegistroTempoDto registro in registros)
            {
                if (registro.Duracao < 0)
                    continue;

                string normalizada = ServicoAgrupamento.NormalizarDescricaoTel((registro.Descricao ?? "").Trim());
                Match correspondencia = PadraoCodigo.Match(normalizada);
                if (correspondencia.Success)
                    codigos.Add(correspondencia.Groups[1].Value.Replace(" ", ""));
            }
        }

        return codigos.ToList();
    }

    public static ResultadoSprint Montar(
        DadosSprint sprint,
        List<ConfiguracaoUsuarioToggl> usuariosSelecionados,
        ResultadoConsulta consulta,
        ConfiguracaoCategoriasSprint categorias,
        Dictionary<string, IssueJira>? issuesPorCodigo = null,
        ConfiguracaoResponsabilidadeSprint? responsabilidade = null,
        ConfiguracaoMapeamentoJiraToggl? mapeamento = null,
        ConfiguracaoStatusFinalSprint? statusFinal = null)
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

        Dictionary<string, ConfiguracaoUsuarioToggl> usuarioPorNome = usuariosSelecionados.ToDictionary(u => u.NomeExibicao);

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

        Dictionary<string, string?> situacaoPorChave = new(StringComparer.OrdinalIgnoreCase);
        Dictionary<string, int> pendentesPorColaborador = new();
        Dictionary<string, int> concluidasPorColaborador = new();

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

                ConfiguracaoUsuarioToggl usuario = usuarioPorNome[nomeExibicao];
                SlotColaborador[]? linhaCompativel = agrupada
                    ? null
                    : linhasEmConstrucao.FirstOrDefault(linha => categoriasUsadas.All(categoria => linha[categoria].NomeExibicao is null));

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

            bool tinhaCodigoParaBuscar = !agrupada && issuesPorCodigo is not null && codigo.Length > 0;
            IssueJira? issueJira = tinhaCodigoParaBuscar
                ? issuesPorCodigo!.GetValueOrDefault(codigo.Replace(" ", ""))
                : null;
            bool jiraIndisponivel = tinhaCodigoParaBuscar && issueJira is null;

            if (!agrupada)
                situacaoPorChave[chave] = issueJira?.Situacao;

            AplicarFallbackJira(linhasEmConstrucao, agrupada, issueJira, mapeamento, usuariosSelecionados);

            (string? grupoResponsavelStatus, bool situacaoSemGrupoResponsavel) = DeterminarGrupoResponsavel(issueJira?.Situacao, responsabilidade);

            foreach (SlotColaborador[] linha in linhasEmConstrucao)
            {
                if (!agrupada)
                {
                    for (int categoria = 0; categoria < 3; categoria++)
                    {
                        string? nomeExibicao = linha[categoria].NomeExibicao;
                        if (nomeExibicao is null)
                            continue;

                        bool concluida = SituacaoGrupoConcluida(GruposCategoria[categoria], grupoResponsavelStatus, situacaoSemGrupoResponsavel);
                        Dictionary<string, int> destino = concluida ? concluidasPorColaborador : pendentesPorColaborador;
                        destino[nomeExibicao] = destino.GetValueOrDefault(nomeExibicao) + 1;
                    }
                }

                tarefas.Add(new LinhaTarefaSprint(
                    codigo,
                    descricao,
                    agrupada,
                    CriarBloco(linha[0], issueJira?.EstimativaDesenvolvimentoHoras ?? 0m),
                    CriarBloco(linha[1], issueJira?.EstimativaRevisaoHoras ?? 0m),
                    CriarBloco(linha[2], issueJira?.EstimativaTestesHoras ?? 0m),
                    issueJira?.Prioridade,
                    issueJira?.Situacao,
                    issueJira?.UrlIssue,
                    jiraIndisponivel,
                    issueJira?.SituacaoCategoria,
                    grupoResponsavelStatus,
                    situacaoSemGrupoResponsavel));
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

        (int pendentesGeral, int concluidasGeral) = ContarPendentesEConcluidas(situacaoPorChave.Values, statusFinal);

        CabecalhoSprint cabecalho = new(
            sprint.Nome,
            sprint.HorasPorDia,
            diasUteis,
            margem,
            sprint.DataInicio,
            sprint.DataFim,
            ct,
            tdPorColaborador,
            pendentesGeral,
            concluidasGeral);

        List<LinhaColaboradorSprint> colaboradores = new();

        foreach (ConfiguracaoUsuarioToggl usuario in usuariosSelecionados)
        {
            segundosRealizadosPorUsuario.TryGetValue(usuario.NomeExibicao, out long segundosRealizados);

            int pendentesColaborador = pendentesPorColaborador.GetValueOrDefault(usuario.NomeExibicao);
            int concluidasColaborador = concluidasPorColaborador.GetValueOrDefault(usuario.NomeExibicao);

            colaboradores.Add(new LinhaColaboradorSprint(
                usuario.NomeExibicao,
                usuario.Sigla,
                usuario.Cor,
                tdPorColaborador,
                segundosRealizados,
                pendentesColaborador,
                concluidasColaborador));
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

    private static (string? Grupo, bool SituacaoSemGrupoResponsavel) DeterminarGrupoResponsavel(string? situacao, ConfiguracaoResponsabilidadeSprint? responsabilidade)
    {
        if (situacao is null || responsabilidade is null)
            return (null, false);

        if (responsabilidade.StatusDev.Contains(situacao, StringComparer.OrdinalIgnoreCase))
            return ("dev", false);

        if (responsabilidade.StatusRev.Contains(situacao, StringComparer.OrdinalIgnoreCase))
            return ("rev", false);

        if (responsabilidade.StatusQa.Contains(situacao, StringComparer.OrdinalIgnoreCase))
            return ("qa", false);

        bool responsabilidadeConfigurada = responsabilidade.StatusDev.Count > 0
            || responsabilidade.StatusRev.Count > 0
            || responsabilidade.StatusQa.Count > 0;

        return (null, responsabilidadeConfigurada);
    }

    private static bool SituacaoGrupoConcluida(string grupo, string? grupoResponsavelStatus, bool situacaoSemGrupoResponsavel) =>
        grupoResponsavelStatus is not null ? grupo != grupoResponsavelStatus : situacaoSemGrupoResponsavel;

    private static void AplicarFallbackJira(
        List<SlotColaborador[]> linhasEmConstrucao,
        bool agrupada,
        IssueJira? issueJira,
        ConfiguracaoMapeamentoJiraToggl? mapeamento,
        List<ConfiguracaoUsuarioToggl> usuariosSelecionados)
    {
        if (agrupada || issueJira is null || mapeamento is null || linhasEmConstrucao.Count == 0)
            return;

        AplicarFallbackCategoria(linhasEmConstrucao, 0, issueJira.Responsavel, mapeamento, usuariosSelecionados);
        AplicarFallbackCategoria(linhasEmConstrucao, 1, issueJira.RevisadoPor, mapeamento, usuariosSelecionados);
    }

    private static void AplicarFallbackCategoria(
        List<SlotColaborador[]> linhasEmConstrucao,
        int categoria,
        string? nomeJira,
        ConfiguracaoMapeamentoJiraToggl mapeamento,
        List<ConfiguracaoUsuarioToggl> usuariosSelecionados)
    {
        if (string.IsNullOrWhiteSpace(nomeJira))
            return;

        bool categoriaJaPreenchida = linhasEmConstrucao.Any(linha => linha[categoria].NomeExibicao is not null);
        if (categoriaJaPreenchida)
            return;

        if (!mapeamento.Mapeamento.TryGetValue(nomeJira, out EntradaMapeamentoJiraToggl? entrada))
            return;

        if (!string.IsNullOrWhiteSpace(entrada.ChaveToggl))
        {
            ConfiguracaoUsuarioToggl? usuario = usuariosSelecionados.FirstOrDefault(u => u.Chave == entrada.ChaveToggl);
            if (usuario is null)
                return;

            linhasEmConstrucao[0][categoria] = new SlotColaborador(usuario.NomeExibicao, usuario.Sigla, usuario.Cor, 0);
            return;
        }

        if (string.IsNullOrWhiteSpace(entrada.Sigla))
            return;

        linhasEmConstrucao[0][categoria] = new SlotColaborador(nomeJira, entrada.Sigla, entrada.Cor, 0);
    }

    private static BlocoCategoriaSprint CriarBloco(SlotColaborador slot, decimal preHoras = 0m) =>
        new(preHoras, slot.Segundos, slot.NomeExibicao, slot.Sigla, slot.Cor);

    private static (int Pendentes, int Concluidas) ContarPendentesEConcluidas(IEnumerable<string?> situacoes, ConfiguracaoStatusFinalSprint? statusFinal)
    {
        int pendentes = 0;
        int concluidas = 0;

        foreach (string? situacao in situacoes)
        {
            bool concluida = EstaNaLista(situacao, statusFinal?.StatusConcluido);
            bool ignorada = !concluida && EstaNaLista(situacao, statusFinal?.StatusIgnorado);

            if (concluida)
                concluidas++;
            else if (!ignorada)
                pendentes++;
        }

        return (pendentes, concluidas);
    }

    private static bool EstaNaLista(string? situacao, List<string>? lista) =>
        situacao is not null && lista is not null && lista.Contains(situacao, StringComparer.OrdinalIgnoreCase);
}