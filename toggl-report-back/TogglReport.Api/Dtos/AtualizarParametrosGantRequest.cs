namespace RelatorioToggl.Api.Dtos;

public record AtualizarParametrosGantRequest(string DataInicio, string DataFim, List<string> TagsSelecionadas, string Agrupamento);