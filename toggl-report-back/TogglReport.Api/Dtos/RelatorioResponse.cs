namespace RelatorioToggl.Api.Dtos;

public record RelatorioResponse(string DataInicio, string DataFim, string Agrupamento, List<RelatorioUsuarioTogglDto> Usuarios);