using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Gant;

namespace RelatorioToggl.Api.Endpoints;

public static class GantEndpoints
{
    public static void MapGantEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoParametrosGant, string caminhoCacheGant)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/gant").WithTags("Gant");

        grupo.MapGet("/parametros", () =>
        {
            ConfiguracaoGant? configuracao = CarregadorConfiguracaoGantIni.Carregar(caminhoParametrosGant);
            return Results.Ok(new ParametrosGantDto(configuracao?.DataInicio, configuracao?.DataFim, configuracao?.TagsSelecionadas ?? new List<string>(), configuracao?.Agrupamento ?? "ambos"));
        })
        .WithSummary("Obtém o período salvo dos parâmetros do Gant");

        grupo.MapPut("/parametros", (AtualizarParametrosGantRequest request) =>
        {
            if (!DateTime.TryParse(request.DataInicio, out DateTime inicio) || !DateTime.TryParse(request.DataFim, out DateTime fim))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            if (fim < inicio)
                return Results.BadRequest("A data fim não pode ser anterior à data início.");

            ConfiguracaoGant configuracao = new()
            {
                DataInicio = inicio.ToString("yyyy-MM-dd"),
                DataFim = fim.ToString("yyyy-MM-dd"),
                TagsSelecionadas = request.TagsSelecionadas,
                Agrupamento = request.Agrupamento
            };

            try
            {
                CarregadorConfiguracaoGantIni.Salvar(caminhoParametrosGant, configuracao);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return Results.Problem("Não foi possível salvar os parâmetros do Gant.", statusCode: 500);
            }

            return Results.Ok(new ParametrosGantDto(configuracao.DataInicio, configuracao.DataFim, configuracao.TagsSelecionadas, configuracao.Agrupamento));
        })
        .WithSummary("Atualiza o período dos parâmetros do Gant");

        grupo.MapPost("/consultas", async (ConsultarRequest request) =>
        {
            if (!DateTime.TryParse(request.DataInicio, out DateTime inicio) || !DateTime.TryParse(request.DataFim, out DateTime fim))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            if (fim < inicio)
                return Results.BadRequest("A data fim não pode ser anterior à data início.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao);
            if (configuracao is not null)
                configuracao.Usuarios = configuracao.Usuarios.Where(u => u.Selecionado).ToList();

            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário selecionado. Cadastre e selecione ao menos um em POST /api/usuarios.");

            CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(caminhoCacheGant);

            if (!request.ForcarConsultaApi && cache is not null && ServicoConsulta.CacheCorrespondeAosParametros(cache, configuracao, inicio, fim))
            {
                ResultadoConsulta resultadoCache = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracao);
                List<EventoConsultaUsuario> eventosCache = resultadoCache.OrdemUsuarios
                    .Select(nome => new EventoConsultaUsuario(nome, StatusConsultaUsuario.Sucesso, null, resultadoCache.RegistrosPorUsuario[nome].Count))
                    .ToList();

                return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: true, eventosCache));
            }

            CacheConsulta? cacheParaFallback = cache is not null
                && cache.DataInicio == inicio.ToString("yyyy-MM-dd")
                && cache.DataFim == fim.ToString("yyyy-MM-dd")
                    ? cache
                    : null;

            List<EventoConsultaUsuario> eventos = new();
            ResultadoConsulta resultado = await ServicoConsulta.ConsultarUsuariosAsync(configuracao, inicio, fim, cacheParaFallback, eventos.Add);
            ServicoConsulta.SalvarCache(caminhoCacheGant, configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);

            return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: false, eventos));
        })
        .WithSummary("Consulta o Toggl para o Gant respeitando o cache e o limite de 30 req/hora; salva o retorno cru em TogglGantData.ini");

        grupo.MapGet("/", (string dataInicio, string dataFim, string? termo) =>
        {
            if (!DateTime.TryParse(dataInicio, out DateTime inicio) || !DateTime.TryParse(dataFim, out DateTime fim))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao);
            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário cadastrado.");

            CacheConsulta? cache = CarregadorCacheIni.Carregar(caminhoCacheGant);
            if (cache is null || cache.DataInicio != dataInicio || cache.DataFim != dataFim)
                return Results.Conflict("Não há consulta salva para esse período. Chame POST /api/gant/consultas primeiro.");

            ConfiguracaoGant? configuracaoGant = CarregadorConfiguracaoGantIni.Carregar(caminhoParametrosGant);
            List<string> tagsSelecionadas = configuracaoGant?.TagsSelecionadas ?? new List<string>();

            ResultadoGant resultado = ServicoGant.Montar(cache, configuracao.Usuarios, inicio, fim, tagsSelecionadas, configuracaoGant?.Agrupamento ?? "ambos", termo);
            return Results.Ok(resultado);
        })
        .WithSummary("Devolve o Gant (linhas por categoria+descrição, células por dia/usuário) a partir do cache do Gant");
    }
}