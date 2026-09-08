namespace RelatorioToggl.Sprints;

public record LinhaTarefaSprint(string Codigo, string Descricao, string NomeExibicao, string Sigla, string Cor, bool Agrupada, BlocoCategoriaSprint Dev, BlocoCategoriaSprint Rev, BlocoCategoriaSprint Qa);