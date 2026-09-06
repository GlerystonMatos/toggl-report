namespace RelatorioToggl.Api.Dtos;

public record UsuarioResumoDto(string Chave, string NomeExibicao, string TokenMascarado, string Sigla, string Cor, bool Selecionado);