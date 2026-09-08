namespace RelatorioToggl.Configuracao;

public static class ServicoSprints
{
    public static bool NomeEmUso(List<Sprint> sprints, string nome, Sprint? ignorar)
        => sprints.Any(s => s != ignorar && s.Nome.Equals(nome, StringComparison.OrdinalIgnoreCase));

    public static string GerarChaveUnica(string nome, List<Sprint> sprintsExistentes)
        => ServicoChaves.GerarChaveUnica(nome, sprintsExistentes.Select(s => s.Chave), "sprint");
}