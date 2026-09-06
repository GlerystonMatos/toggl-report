using System.IO.Compression;

namespace RelatorioToggl.Api.Endpoints;

public static class DadosEndpoints
{
    public static void MapDadosEndpoints(this WebApplication app, string pastaDados)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/dados").WithTags("Dados");

        grupo.MapGet("/download", () => BaixarPastaDados(pastaDados))
            .WithSummary("Baixa a pasta dados/ inteira (todos os .ini presentes), compactada em .zip");
    }

    private static IResult BaixarPastaDados(string pastaDados)
    {
        if (!Directory.Exists(pastaDados))
        {
            return Results.NotFound();
        }

        string[] arquivos = Directory.GetFiles(pastaDados);
        if (arquivos.Length == 0)
        {
            return Results.NotFound();
        }

        MemoryStream memoria = new();
        using (ZipArchive zip = new(memoria, ZipArchiveMode.Create, leaveOpen: true))
        {
            foreach (string arquivo in arquivos)
            {
                zip.CreateEntryFromFile(arquivo, Path.GetFileName(arquivo));
            }
        }

        memoria.Position = 0;
        return Results.File(memoria, "application/zip", "dados.zip");
    }
}