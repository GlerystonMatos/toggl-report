namespace RelatorioToggl.Api.Dtos;

public record SalvarConfiguracaoJiraRequest(
    string UrlDominio,
    string Email,
    string? ApiToken,
    string CampoEstimativaDesenvolvimentoId,
    string CampoEstimativaDesenvolvimentoNome,
    string CampoRevisadoPorId,
    string CampoRevisadoPorNome,
    string CampoEstimativaRevisaoId,
    string CampoEstimativaRevisaoNome,
    string CampoEstimativaTestesId,
    string CampoEstimativaTestesNome);