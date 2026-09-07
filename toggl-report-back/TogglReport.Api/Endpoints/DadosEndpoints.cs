using System.IO.Compression;

namespace RelatorioToggl.Api.Endpoints;

public static class DadosEndpoints
{
    public static void MapDadosEndpoints(this WebApplication app, string pastaDados)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/dados").WithTags("Dados");

        grupo.MapGet("/download", () => BaixarPastaDados(pastaDados))
            .WithSummary("Baixa a pasta dados/ inteira (todos os .ini presentes), compactada em .zip");

        grupo.MapPost("/restaurar", (IFormFile arquivo) => RestaurarPastaDados(arquivo, pastaDados))
            .WithSummary("Restaura a pasta dados/ a partir de um .zip enviado (sobrescreve arquivos existentes)")
            .DisableAntiforgery();
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

    private static IResult RestaurarPastaDados(IFormFile arquivo, string pastaDados)
    {
        if (arquivo.Length == 0)
        {
            return Results.BadRequest("Arquivo vazio.");
        }

        try
        {
            if (!Directory.Exists(pastaDados))
            {
                Directory.CreateDirectory(pastaDados);
            }

            using Stream fluxo = arquivo.OpenReadStream();
            using ZipArchive zip = new(fluxo);

            foreach (ZipArchiveEntry entrada in zip.Entries)
            {
                if (string.IsNullOrEmpty(entrada.Name))
                {
                    continue;
                }

                if (entrada.FullName != entrada.Name)
                {
                    return Results.BadRequest(
                        "O arquivo .zip deve conter os arquivos diretamente na raiz, sem uma pasta " +
                        "\"dados\" (ou qualquer outra) por dentro — compacte o conteúdo da pasta dados/, " +
                        "não a pasta em si.");
                }
            }

            zip.ExtractToDirectory(pastaDados, overwriteFiles: true);
        }
        catch (InvalidDataException)
        {
            return Results.BadRequest("Arquivo enviado não é um .zip válido.");
        }
        catch (Exception ex) when (ex is IOException or UnauthorizedAccessException)
        {
            return Results.Problem("Não foi possível restaurar os dados.", statusCode: 500);
        }

        return Results.NoContent();
    }
}