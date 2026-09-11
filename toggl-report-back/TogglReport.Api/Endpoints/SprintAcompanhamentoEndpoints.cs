using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Sprints;

namespace RelatorioToggl.Api.Endpoints;

public static class SprintAcompanhamentoEndpoints
{
    public static void MapSprintAcompanhamentoEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoUsuarios, string caminhoSprints, string caminhoCategoriasSprint, string caminhoCacheSprint)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/sprint").WithTags("Sprint");

        grupo.MapGet("/", (string? chaveSprint) =>
        {
            if (string.IsNullOrWhiteSpace(chaveSprint))
                return Results.BadRequest("A chave do sprint é obrigatória.");

            List<Sprint> sprints = CarregadorSprintsIni.Carregar(caminhoSprints);
            Sprint? sprint = sprints.FirstOrDefault(s => s.Chave == chaveSprint);
            if (sprint is null)
                return Results.NotFound("Sprint não encontrado.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao, caminhoUsuarios);
            List<ConfiguracaoUsuarioToggl> usuariosSelecionados = configuracao?.Usuarios.Where(u => u.Selecionado).ToList()
                ?? new List<ConfiguracaoUsuarioToggl>();
            if (usuariosSelecionados.Count == 0)
                return Results.BadRequest("Nenhum usuário do Toggl cadastrado.");

            CacheConsulta? cache = ServicoConsulta.CarregarCacheSeExistente(caminhoCacheSprint);
            if (cache is null || cache.DataInicio != sprint.DataInicio || cache.DataFim != sprint.DataFim)
                return Results.Conflict("Não há consulta salva para esse período. Chame POST /api/sprint/consultas primeiro.");

            ConfiguracaoApp configuracaoSelecionados = new() { Usuarios = usuariosSelecionados };
            ResultadoConsulta consulta = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracaoSelecionados);

            ConfiguracaoCategoriasSprint categorias = CarregadorConfiguracaoCategoriasSprintIni.Carregar(caminhoCategoriasSprint);

            ResultadoSprint resultado = ServicoSprint.Montar(sprint, usuariosSelecionados, consulta, categorias);
            return Results.Ok(resultado);
        })
        .WithSummary("Devolve o acompanhamento do sprint (cabeçalho de capacidade + tarefas por descrição) a partir do cache do sprint");
    }
}