namespace RelatorioToggl.Apresentacao;

public static class Rotulos
{
    public static string Agrupamento(string valor) => valor switch
    {
        "descricao" => "Por descrição",
        "tag" => "Por tag",
        "ambos" => "Ambos",
        _ => valor
    };

    public static string Data(DateTime valor) => valor.ToString("dd/MM/yyyy");
}