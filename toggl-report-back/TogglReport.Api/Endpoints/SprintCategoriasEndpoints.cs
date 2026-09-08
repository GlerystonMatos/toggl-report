using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;

namespace RelatorioToggl.Api.Endpoints;

public static class SprintCategoriasEndpoints
{
    public static void MapSprintCategoriasEndpoints(this WebApplication app, string caminhoCategoriasSprint)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/sprint/categorias").WithTags("Sprint");

        grupo.MapGet("/", () =>
        {
            ConfiguracaoCategoriasSprint configuracao = CarregadorConfiguracaoCategoriasSprintIni.Carregar(caminhoCategoriasSprint);
            return Results.Ok(new CategoriasSprintDto(configuracao.Dev, configuracao.Rev, configuracao.Qa, configuracao.Agrupamento, configuracao.TagsDetalhadas));
        })
        .WithSummary("Obtém o mapeamento global de tags por categoria de tarefa (DEV/REV/QA)");

        grupo.MapPut("/", (AtualizarCategoriasSprintRequest request) =>
        {
            if (request.Agrupamento is not ("descricao" or "tag" or "ambos"))
                return Results.BadRequest("Agrupamento deve ser 'descricao', 'tag' ou 'ambos'.");

            ConfiguracaoCategoriasSprint configuracao = new()
            {
                Dev = Normalizar(request.Dev),
                Rev = Normalizar(request.Rev),
                Qa = Normalizar(request.Qa),
                Agrupamento = request.Agrupamento,
                TagsDetalhadas = Normalizar(request.TagsDetalhadas)
            };

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorConfiguracaoCategoriasSprintIni.Salvar(caminhoCategoriasSprint, configuracao),
                "Não foi possível salvar as categorias.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new CategoriasSprintDto(configuracao.Dev, configuracao.Rev, configuracao.Qa, configuracao.Agrupamento, configuracao.TagsDetalhadas));
        })
        .WithSummary("Atualiza o mapeamento global de tags por categoria de tarefa (DEV/REV/QA)");
    }

    private static List<string> Normalizar(List<string>? tags) =>
        (tags ?? new List<string>())
            .Where(tag => !string.IsNullOrWhiteSpace(tag))
            .Select(tag => tag.Trim())
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();
}