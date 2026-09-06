using RelatorioToggl.Configuracao;
using RelatorioToggl.Consultas;
using RelatorioToggl.Relatorios;

namespace RelatorioToggl.Api.Endpoints;

public static class BuscaEndpoints
{
    public static void MapBuscaEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoCache)
    {
        app.MapGet("/api/busca", (string termo) =>
        {
            if (string.IsNullOrWhiteSpace(termo))
                return Results.BadRequest("Informe um termo de busca.");

            ConfiguracaoApp? configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao);
            if (configuracao is null || configuracao.Usuarios.Count == 0)
                return Results.BadRequest("Nenhum usuário cadastrado.");

            CacheConsulta? cache = CarregadorCacheIni.Carregar(caminhoCache);
            if (cache is null)
                return Results.Conflict("Não há dados em cache. Chame POST /api/consultas primeiro.");

            ResultadoConsulta dados = ServicoConsulta.CarregarRegistrosDoCache(cache, configuracao);
            ResultadoBuscaDescricao resultado = ServicoBuscaDescricao.Buscar(dados.OrdemUsuarios, dados.RegistrosPorUsuario, termo);

            return Results.Ok(resultado);
        })
        .WithTags("Busca")
        .WithSummary("Busca por parte da descrição sobre os dados em cache (sem nova chamada à API)");
    }
}