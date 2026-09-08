namespace RelatorioToggl.Api.Dtos;

public record CriarSprintRequest(string Nome, decimal HorasPorDia, string DataInicio, string DataFim);