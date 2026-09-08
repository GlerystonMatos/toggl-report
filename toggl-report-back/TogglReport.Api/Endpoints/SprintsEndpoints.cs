using RelatorioToggl.Api.Dtos;
using RelatorioToggl.Configuracao;

namespace RelatorioToggl.Api.Endpoints;

public static class SprintsEndpoints
{
    public static void MapSprintsEndpoints(this WebApplication app, string caminhoSprints)
    {
        RouteGroupBuilder grupo = app.MapGroup("/api/sprints").WithTags("Sprints");

        grupo.MapGet("/", () =>
        {
            List<Sprint> sprints = CarregadorSprintsIni.Carregar(caminhoSprints);
            List<SprintDto> resposta = sprints
                .Select(s => new SprintDto(s.Chave, s.Nome, s.HorasPorDia, s.DataInicio, s.DataFim))
                .ToList();
            return Results.Ok(resposta);
        })
        .WithSummary("Lista os sprints cadastrados");

        grupo.MapPost("/", (CriarSprintRequest request) =>
        {
            if (string.IsNullOrWhiteSpace(request.Nome))
                return Results.BadRequest("O nome do sprint é obrigatório.");

            if (!ValidacaoDatas.Tenta(request.DataInicio, request.DataFim, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            if (request.HorasPorDia <= 0)
                return Results.BadRequest("As horas por dia devem ser maiores que zero.");

            List<Sprint> sprints = CarregadorSprintsIni.Carregar(caminhoSprints);

            if (ServicoSprints.NomeEmUso(sprints, request.Nome, ignorar: null))
                return Results.Conflict($"Já existe um sprint chamado '{request.Nome}'.");

            string chave = ServicoSprints.GerarChaveUnica(request.Nome, sprints);
            Sprint sprint = new()
            {
                Chave = chave,
                Nome = request.Nome,
                HorasPorDia = request.HorasPorDia,
                DataInicio = inicio.ToString("yyyy-MM-dd"),
                DataFim = fim.ToString("yyyy-MM-dd")
            };
            sprints.Add(sprint);

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorSprintsIni.Salvar(caminhoSprints, sprints),
                "Não foi possível salvar os sprints.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Created($"/api/sprints/{chave}",
                new SprintDto(sprint.Chave, sprint.Nome, sprint.HorasPorDia, sprint.DataInicio, sprint.DataFim));
        })
        .WithSummary("Cadastra um sprint");

        grupo.MapPut("/{chave}", (string chave, EditarSprintRequest request) =>
        {
            List<Sprint> sprints = CarregadorSprintsIni.Carregar(caminhoSprints);
            Sprint? sprint = sprints.FirstOrDefault(s => s.Chave == chave);
            if (sprint is null)
                return Results.NotFound();

            string nome = string.IsNullOrWhiteSpace(request.Nome) ? sprint.Nome : request.Nome;
            decimal horasPorDia = request.HorasPorDia ?? sprint.HorasPorDia;
            string dataInicioTexto = string.IsNullOrWhiteSpace(request.DataInicio) ? sprint.DataInicio : request.DataInicio;
            string dataFimTexto = string.IsNullOrWhiteSpace(request.DataFim) ? sprint.DataFim : request.DataFim;

            if (!ValidacaoDatas.Tenta(dataInicioTexto, dataFimTexto, out DateTime inicio, out DateTime fim, out IResult? erroDatas))
                return erroDatas!;

            if (horasPorDia <= 0)
                return Results.BadRequest("As horas por dia devem ser maiores que zero.");

            if (ServicoSprints.NomeEmUso(sprints, nome, ignorar: sprint))
                return Results.Conflict($"Já existe um sprint chamado '{nome}'.");

            sprint.Nome = nome;
            sprint.HorasPorDia = horasPorDia;
            sprint.DataInicio = inicio.ToString("yyyy-MM-dd");
            sprint.DataFim = fim.ToString("yyyy-MM-dd");

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorSprintsIni.Salvar(caminhoSprints, sprints),
                "Não foi possível salvar os sprints.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.Ok(new SprintDto(sprint.Chave, sprint.Nome, sprint.HorasPorDia, sprint.DataInicio, sprint.DataFim));
        })
        .WithSummary("Edita um sprint (campos nulos ou omitidos não são alterados)");

        grupo.MapDelete("/{chave}", (string chave) =>
        {
            List<Sprint> sprints = CarregadorSprintsIni.Carregar(caminhoSprints);
            Sprint? sprint = sprints.FirstOrDefault(s => s.Chave == chave);
            if (sprint is null)
                return Results.NotFound();

            sprints.Remove(sprint);

            IResult? erroPersistencia = TratamentoIo.Executar(
                () => CarregadorSprintsIni.Salvar(caminhoSprints, sprints),
                "Não foi possível salvar os sprints.");
            if (erroPersistencia is not null)
                return erroPersistencia;

            return Results.NoContent();
        })
        .WithSummary("Remove um sprint cadastrado");
    }
}