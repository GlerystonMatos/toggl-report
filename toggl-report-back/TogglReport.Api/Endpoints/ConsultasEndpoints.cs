using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;

namespace RelatorioToggl.Api.Endpoints;

public static class ConsultasEndpoints
{
    public static void MapConsultasEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoCache)
    {
        app.MapPost("/api/consultas", async (ConsultarRequest request) =>
        {
            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is not null)
                configuracao.Usuarios = configuracao.Usuarios.Where(u => u.Selecionado).ToList();

            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário selecionado. Cadastre e selecione ao menos um em POST /api/usuarios.");

            CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(caminhoCache);

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
            ServicoConsulta.SalvarCache(caminhoCache, configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);

            return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: false, eventos));
        })
        .WithTags("Consultas")
        .WithSummary("Consulta o Toggl respeitando o cache e o limite de 30 req/hora; salva o retorno cru em TogglRelatorioData.ini");
    }
}