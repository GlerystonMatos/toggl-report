using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;

namespace RelatorioToggl.Api.Endpoints;

public static class SprintConsultasEndpoints
{
    public static void MapSprintConsultasEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoCacheSprint)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/sprint").WithTags("Sprint");

        grupo.MapPost("/consultas", async (ConsultarRequest request) =>
        {
            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            if (configuracao is not null)
                configuracao.Usuarios = configuracao.Usuarios.Where(u => u.Selecionado).ToList();

            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário do Toggl selecionado. Cadastre e selecione ao menos um em POST /api/usuarios-toggl.");

            CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(caminhoCacheSprint);

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
            ServicoConsulta.SalvarCache(caminhoCacheSprint, configuracao, inicio, fim, resultado.RegistrosPorUsuario, resultado.OrdemUsuarios);

            return Results.Ok(new ConsultarResponse(request.DataInicio, request.DataFim, VeioDoCache: false, eventos));
        })
        .WithSummary("Consulta o Toggl para o período do sprint e grava o cache dedicado.");
    }
}