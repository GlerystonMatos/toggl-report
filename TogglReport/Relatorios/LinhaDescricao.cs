namespace RelatorioToggl.Relatorios;

/// <summary>Uma descrição agrupada, com o tempo total e a tag de uma das entradas (para exibir "(tag) descrição").</summary>
public record LinhaDescricao(string Descricao, long Segundos, string? Tag);