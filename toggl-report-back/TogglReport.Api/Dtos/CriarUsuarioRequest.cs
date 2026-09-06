namespace RelatorioToggl.Api.Dtos;

public record CriarUsuarioRequest(string NomeExibicao, string TokenApi, bool IgnorarValidacao = false, string Sigla = "", string Cor = "", bool Selecionado = true);