namespace RelatorioToggl.Api.Dtos;

public record CriarUsuarioTogglRequest(string NomeExibicao, string TokenApi, bool IgnorarValidacao = false, string Sigla = "", string Cor = "", bool Selecionado = true);