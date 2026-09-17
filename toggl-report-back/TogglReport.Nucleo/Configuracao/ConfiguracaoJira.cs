namespace RelatorioToggl.Configuracao;

public class ConfiguracaoJira
{
    public string UrlDominio { get; set; } = "";

    public string Email { get; set; } = "";

    public string ApiToken { get; set; } = "";

    public string CampoEstimativaDesenvolvimentoId { get; set; } = "";

    public string CampoEstimativaDesenvolvimentoNome { get; set; } = "";

    public string CampoEstimativaRevisaoId { get; set; } = "";

    public string CampoEstimativaRevisaoNome { get; set; } = "";

    public string CampoEstimativaTestesId { get; set; } = "";

    public string CampoEstimativaTestesNome { get; set; } = "";

    public string CampoRevisadoPorId { get; set; } = "";

    public string CampoRevisadoPorNome { get; set; } = "";
}