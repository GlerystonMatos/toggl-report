using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;

namespace RelatorioToggl.Api.Endpoints;

public static class ConfiguracaoEndpoints
{
    public static void MapConfiguracaoEndpoints(this WebApplication app, string caminhoConfiguracao)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/configuracao").WithTags("Configuração");

        grupo.MapGet("/", () =>
        {
            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao) ?? new ConfiguracaoApp();
            return Results.Ok(new ParametrosConfiguracaoDto(
                configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas, configuracao.DataInicioAnterior, configuracao.DataFimAnterior));
        })
        .WithSummary("Obtém agrupamento, tags detalhadas e último período salvos");

        grupo.MapPut("/", (AtualizarParametrosRequest request) =>
        {
            if (request.Agrupamento is not ("descricao" or "tag" or "ambos"))
                return Results.BadRequest("Agrupamento deve ser 'descricao', 'tag' ou 'ambos'.");

            if (!DateTime.TryParse(request.DataInicio, out DateTime inicio) || !DateTime.TryParse(request.DataFim, out DateTime fim))
                return Results.BadRequest("Datas inválidas. Use o formato AAAA-MM-DD.");

            if (fim < inicio)
                return Results.BadRequest("A data fim não pode ser anterior à data início.");

            ConfiguracaoApp configuracao = CarregadorConfiguracaoIni.Carregar(caminhoConfiguracao) ?? new ConfiguracaoApp();
            configuracao.AgrupamentoPadrao = request.Agrupamento;
            configuracao.TagsDetalhadas = request.TagsDetalhadas;
            configuracao.DataInicioAnterior = inicio.ToString("yyyy-MM-dd");
            configuracao.DataFimAnterior = fim.ToString("yyyy-MM-dd");

            try
            {
                CarregadorConfiguracaoIni.Salvar(caminhoConfiguracao, configuracao);
            }
            catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
            {
                return Results.Problem("Não foi possível salvar a configuração.", statusCode: 500);
            }

            return Results.Ok(new ParametrosConfiguracaoDto(
                configuracao.AgrupamentoPadrao, configuracao.TagsDetalhadas, configuracao.DataInicioAnterior, configuracao.DataFimAnterior));
        })
        .WithSummary("Atualiza agrupamento, tags detalhadas e período; preserva os usuários já cadastrados");
    }
}