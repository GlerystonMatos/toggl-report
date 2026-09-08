namespace RelatorioToggl.Configuracao;

public static class Agrupamento
{
    public static bool EhValido(string? valor) => valor is "descricao" or "tag" or "ambos";
}