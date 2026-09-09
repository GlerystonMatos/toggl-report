namespace RelatorioToggl.Sprints;

public record LinhaTarefaSprint(string Codigo, string Descricao, bool Agrupada, BlocoCategoriaSprint Dev, BlocoCategoriaSprint Rev, BlocoCategoriaSprint Qa);