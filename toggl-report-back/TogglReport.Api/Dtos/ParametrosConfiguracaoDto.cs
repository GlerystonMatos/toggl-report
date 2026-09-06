namespace RelatorioToggl.Api.Dtos;

public record ParametrosConfiguracaoDto(string Agrupamento, List<string> TagsDetalhadas, string? DataInicio, string? DataFim);