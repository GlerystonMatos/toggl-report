using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Gant;

namespace RelatorioToggl.Api.Endpoints;

public static class GantEndpoints
{
    public static void MapGantEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoParametrosGant, string caminhoCacheGant)
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
            if (!Agrupamento.EhValido(request.Agrupamento))
                return Results.BadRequest("Agrupamento deve ser 'descricao', 'tag' ou 'ambos'.");

            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            ConfiguracaoGant configuracao = new()
            {
                DataInicio = inicio.ToString("yyyy-MM-dd"),
                DataFim = fim.ToString("yyyy-MM-dd"),
                TagsSelecionadas = request.TagsSelecionadas,
                Agrupamento = request.Agrupamento
            };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoGantIni.Salvar(caminhoParametrosGant, configuracao),
                "Não foi possível salvar os parâmetros do Gant.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new ParametrosGantDto(configuracao.DataInicio, configuracao.DataFim, configuracao.TagsSelecionadas, configuracao.Agrupamento));
        })
        .WithSummary("Atualiza o período dos parâmetros do Gant");

        grupo.MapPost("/consultas", async (ConsultarRequest request) =>
        {
            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is not null)
                configuracao.Usuarios = configuracao.Usuarios.Where(u => u.Selecionado).ToList();

            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário do Toggl selecionado. Cadastre e selecione ao menos um em POST /api/usuarios-toggl.");

            CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(caminhoCacheGant);

            if (!request.ForcarConsultaApi && cache is not null && ServicoConsulta.CacheCorrespondeAosParametros(cache, configuracao, inicio, fim))
            {
                ResultadoConsulta resultadoCache = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracao);
                List<EventoConsultaUsuarioToggl> eventosCache = resultadoCache.OrdemUsuarios
                    .Select(nome => new EventoConsultaUsuarioToggl(nome, StatusConsultaUsuarioToggl.Sucesso, null, resultadoCache.RegistrosPorUsuario[nome].Count))
                    .ToList();

                return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: true, eventosCache));
            }

            CacheConsulta? cacheParaFallback = cache is not null
                && cache.DataInicio == inicio.ToString("yyyy-MM-dd")
                && cache.DataFim == fim.ToString("yyyy-MM-dd")
                    ? cache
                    : null;

            List<EventoConsultaUsuarioToggl> eventos = new();
            ResultadoConsulta resultado = await ServicoConsulta.ConsultarUsuariosAsync(configuracao, inicio, fim, cacheParaFallback, eventos.Add);
            ServicoConsulta.SalvarCache(caminhoCacheGant, configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);

            return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: false, eventos));
        })
        .WithSummary("Consulta o Toggl para o Gant respeitando o cache e o limite de 30 req/hora; salva o retorno cru em TogglGantData.ini");

        grupo.MapGet("/", (string dataInicio, string dataFim, string? termo) =>
        {
            if (!DateTime.TryParse(dataInicio, out DateTime inicio) || !DateTime.TryParse(dataFim, out DateTime fim))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário do Toggl cadastrado.");

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