namespace RelatorioToggl.Configuracao;

public class DadosSprint
{
    public string Chave { get; set; } = "";

    public string Nome { get; set; } = "";

    public decimal HorasPorDia { get; set; }

    public string DataInicio { get; set; } = "";

    public string DataFim { get; set; } = "";

    public bool Fechado { get; set; }
}