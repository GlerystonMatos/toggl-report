namespace RelatorioToggl.Api.Dtos;

public record IssueJiraDto(string Chave, string? Prioridade, string? Situacao, decimal? EstimativaDesenvolvimentoHoras, string? UrlIssue, string? SituacaoCategoria, string? Responsavel, string? RevisadoPor, decimal? EstimativaRevisaoHoras, decimal? EstimativaTestesHoras);