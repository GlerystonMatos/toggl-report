namespace RelatorioToggl.Api.Dtos;

public record ParametrosGantDto(string? DataInicio, string? DataFim, List<string> TagsSelecionadas, string Agrupamento);