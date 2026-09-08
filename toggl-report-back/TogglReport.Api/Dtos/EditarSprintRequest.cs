namespace RelatorioToggl.Api.Dtos;

public record EditarSprintRequest(string? Nome, decimal? HorasPorDia, string? DataInicio, string? DataFim);