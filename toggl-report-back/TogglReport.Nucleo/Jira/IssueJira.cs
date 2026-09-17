namespace RelatorioToggl.Jira;

public sealed record IssueJira(string Chave, string? Prioridade, string? Situacao, decimal? EstimativaDesenvolvimentoHoras, string? UrlIssue = null, string? SituacaoCategoria = null, string? Responsavel = null, string? RevisadoPor = null, decimal? EstimativaRevisaoHoras = null, decimal? EstimativaTestesHoras = null);