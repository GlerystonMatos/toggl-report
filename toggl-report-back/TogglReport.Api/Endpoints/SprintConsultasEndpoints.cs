using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Jira;
using RelatorioToggl.Sprint;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Api.Endpoints;

public static class SprintConsultasEndpoints
{
    public static void MapSprintConsultasEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoSprints, string caminhoCacheSprint, string caminhoConfiguracoesGerais, string caminhoJiraSprintData)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/sprint").WithTags("Sprint");

        grupo.MapPost("/consultas", async (ConsultarSprintRequest request) =>
        {
            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            if (string.IsNullOrWhiteSpace(request.ChaveSprint))
                return Results.BadRequest("A chave do sprint é obrigatória.");

            DadosSprint? sprintCadastrado = CarregadorSprintsIni.Carregar(caminhoSprints)
                .FirstOrDefault(s => s.Chave == request.ChaveSprint);
            bool sprintFechado = sprintCadastrado?.Fechado ?? false;

            string origem = string.IsNullOrWhiteSpace(request.Origem) ? "nenhum" : request.Origem.Trim().ToLowerInvariant();
            if (origem is not ("nenhum" or "toggl" or "jira" or "ambos"))
                return Results.BadRequest("Origem inválida. Use \"nenhum\", \"toggl\", \"jira\" ou \"ambos\".");

            if (sprintFechado)
                origem = "nenhum";

            bool forcarToggl = origem is "toggl" or "ambos";
            bool forcarJira = origem is "jira" or "ambos";

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is not null)
                configuracao.Usuarios = configuracao.Usuarios.Where(u => u.Selecionado).ToList();

            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário do Toggl selecionado. Cadastre e selecione ao menos um em POST /api/usuarios-toggl.");

            CacheConsulta? cache = CarregadorCacheSprintIni.CarregarSeExistente(caminhoCacheSprint, request.ChaveSprint);
            bool usarCacheToggl = !forcarToggl && cache is not null && ServicoConsulta.CacheCorrespondeAosParametros(cache, configuracao, inicio, fim);

            if (sprintFechado && !usarCacheToggl)
                return Results.Conflict("Este sprint está fechado. Os dados ficam travados no que foi salvo ao fechar — reabra o sprint para consultar de novo.");

            Dictionary<string, List<RegistroTempoDto>> registrosParaJira;
            List<EventoConsultaUsuarioToggl> eventos;
            bool houveConsultaRealToggl;

            if (usarCacheToggl)
            {
                ResultadoConsulta resultadoCache = ServicoConsulta.CarregarRegistrosDoCache(cache!, configuracao);
                eventos = resultadoCache.OrdemUsuarios
                    .Select(nome => new EventoConsultaUsuarioToggl(nome, StatusConsultaUsuarioToggl.Sucesso, null, resultadoCache.RegistrosPorUsuario[nome].Count))
                    .ToList();
                registrosParaJira = resultadoCache.RegistrosPorUsuario;
                houveConsultaRealToggl = false;
            }
            else
            {
                CacheConsulta? cacheParaFallback = cache is not null
                    && cache.DataInicio == inicio.ToString("yyyy-MM-dd")
                    && cache.DataFim == fim.ToString("yyyy-MM-dd")
                        ? cache
                        : null;

                List<EventoConsultaUsuarioToggl> eventosConsulta = new();
                ResultadoConsulta resultado = await ServicoConsulta.ConsultarUsuariosAsync(configuracao, inicio, fim, cacheParaFallback, eventosConsulta.Add);

                CacheConsulta cacheParaSalvar = ServicoConsulta.MontarCache(configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);
                CarregadorCacheSprintIni.SalvarSeConseguir(caminhoCacheSprint, request.ChaveSprint, cacheParaSalvar);

                eventos = eventosConsulta;
                registrosParaJira = resultado.RegistrosPorUsuario;
                houveConsultaRealToggl = true;
            }

            if (forcarJira || houveConsultaRealToggl)
                await AtualizarCacheJiraAsync(caminhoConfiguracoesGerais, caminhoJiraSprintData, request.ChaveSprint, registrosParaJira);

            return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: !houveConsultaRealToggl, eventos));
        })
        .WithSummary("Consulta o Toggl e/ou o Jira para o período do sprint; origem escolhe o que forçar (\"nenhum\" reaproveita o cache dos dois quando possível). Sprint fechado sempre usa \"nenhum\" e nunca chama a API de verdade.");
    }

    private static async Task AtualizarCacheJiraAsync(string caminhoConfiguracoesGerais, string caminhoJiraSprintData, string chaveSprint, Dictionary<string, List<RegistroTempoDto>> registrosPorUsuario)
    {
        ConfiguracaoJira? configuracaoJira = CarregadorConfiguracaoJiraIni.Carregar(caminhoConfiguracoesGerais);
        if (configuracaoJira is null || string.IsNullOrWhiteSpace(configuracaoJira.ApiToken))
            return;

        List<string> codigos = ServicoSprint.ExtrairCodigosJira(registrosPorUsuario);
        if (codigos.Count == 0)
            return;

        try
        {
            ClienteApiJira cliente = new(configuracaoJira.UrlDominio, configuracaoJira.Email, configuracaoJira.ApiToken);
            ResultadoApiJira<List<IssueJira>> resultado = await cliente.BuscarIssuesAsync(codigos, configuracaoJira.CampoEstimativaDesenvolvimentoId, configuracaoJira.CampoRevisadoPorId, configuracaoJira.CampoEstimativaRevisaoId, configuracaoJira.CampoEstimativaTestesId);
            if (resultado.Sucesso)
                CarregadorCacheJiraSprintIni.SalvarParaSprint(caminhoJiraSprintData, chaveSprint, resultado.Dados!);
        }
        catch (UriFormatException)
        {
        }
    }
}