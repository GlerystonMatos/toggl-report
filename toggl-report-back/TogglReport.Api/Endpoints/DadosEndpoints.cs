namespace RelatorioToggl.Api.Endpoints;

public static class DadosEndpoints
{
    public static void MapDadosEndpoints(this WebApplication app, string caminhoConfiguracao, string caminhoCache)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/dados").WithTags("Dados");

        grupo.MapGet("/download/configuracao", () => BaixarArquivo(caminhoConfiguracao, "TogglReport.ini"))
            .WithSummary("Baixa o TogglReport.ini cru");

        grupo.MapGet("/download/cache", () => BaixarArquivo(caminhoCache, "ToggleData.ini"))
            .WithSummary("Baixa o ToggleData.ini cru");
    }

    private static IResult BaixarArquivo(string caminho, string nomeArquivo) =>
        File.Exists(caminho) ? Results.File(caminho, "text/plain", nomeArquivo) : Results.NotFound();
}