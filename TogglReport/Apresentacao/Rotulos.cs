namespace RelatorioToggl.Apresentacao;

/// <summary>Traduções curtas de valores internos para exibição.</summary>
public static class Rotulos
{
    public static string Agrupamento(string valor) => valor switch
    {
        "descricao" => "Por descrição",
        "tag" => "Por tag",
        "ambos" => "Ambos",
        _ => valor
    };
}