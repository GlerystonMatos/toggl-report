namespace RelatorioToggl.Api.Dtos;

public record AtualizarParametrosRequest(string Agrupamento, List<string> TagsDetalhadas, string DataInicio, string DataFim);