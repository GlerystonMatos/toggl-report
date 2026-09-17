namespace RelatorioToggl.Api.Dtos;

public record ConfiguracaoJiraDto(
    string UrlDominio,
    string Email,
    string TokenMascarado,
    string CampoEstimativaDesenvolvimentoId,
    string CampoEstimativaDesenvolvimentoNome,
    string CampoRevisadoPorId,
    string CampoRevisadoPorNome,
    string CampoEstimativaRevisaoId,
    string CampoEstimativaRevisaoNome,
    string CampoEstimativaTestesId,
    string CampoEstimativaTestesNome);