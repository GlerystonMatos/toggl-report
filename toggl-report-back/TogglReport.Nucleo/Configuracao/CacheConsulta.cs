namespace RelatorioToggl.Configuracao;

public class CacheConsulta
{
    public string DataInicio { get; set; } = "";

    public string DataFim { get; set; } = "";

    public List<UsuarioTogglCacheado> Usuarios { get; set; } = new();
}