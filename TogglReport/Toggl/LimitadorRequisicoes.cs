namespace RelatorioToggl.Toggl;

public static class LimitadorRequisicoes
{
    public const int MaximoPorHora = 30;

    private static readonly Dictionary<string, List<DateTime>> RequisicoesPorChaveUsuario = new();

    public static bool PodeConsultar(string chaveUsuario)
    {
        RemoverRequisicoesAntigas(chaveUsuario);
        return !RequisicoesPorChaveUsuario.TryGetValue(chaveUsuario, out List<DateTime>? momentos) || momentos.Count < MaximoPorHora;
    }

    public static void RegistrarConsulta(string chaveUsuario)
    {
        RemoverRequisicoesAntigas(chaveUsuario);

        if (!RequisicoesPorChaveUsuario.TryGetValue(chaveUsuario, out List<DateTime>? momentos))
        {
            momentos = new List<DateTime>();
            RequisicoesPorChaveUsuario[chaveUsuario] = momentos;
        }

        momentos.Add(DateTime.UtcNow);
    }

    private static void RemoverRequisicoesAntigas(string chaveUsuario)
    {
        if (!RequisicoesPorChaveUsuario.TryGetValue(chaveUsuario, out List<DateTime>? momentos))
            return;

        DateTime limite = DateTime.UtcNow.AddHours(-1);
        momentos.RemoveAll(momento => momento < limite);
    }
}