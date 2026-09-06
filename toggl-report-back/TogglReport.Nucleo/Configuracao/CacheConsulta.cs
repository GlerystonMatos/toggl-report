namespace RelatorioToggl.Configuracao;

public class CacheConsulta
{
    public string DataInicio { get; set; } = "";

    public string DataFim { get; set; } = "";

    public List<UsuarioCacheado> Usuarios { get; set; } = new();
}