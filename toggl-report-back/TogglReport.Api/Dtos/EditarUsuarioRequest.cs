namespace RelatorioToggl.Api.Dtos;

public record EditarUsuarioRequest(string? NomeExibicao, string? TokenApi, bool IgnorarValidacao = false, string? Sigla = null, string? Cor = null, bool? Selecionado = null);