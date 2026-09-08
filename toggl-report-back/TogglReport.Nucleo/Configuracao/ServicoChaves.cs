namespace RelatorioToggl.Configuracao;

public static class ServicoChaves
{
    public static string GerarChaveUnica(string nome, IEnumerable<string> chavesExistentes, string fallback)
    {
        string chaveBase = new string(nome.Where(char.IsLetterOrDigit).ToArray()).ToLowerInvariant();
        if (string.IsNullOrEmpty(chaveBase))
            chaveBase = fallback;

        string chave = chaveBase;
        int sufixo = 1;
        while (chavesExistentes.Any(c => c.Equals(chave, StringComparison.OrdinalIgnoreCase)))
        {
            sufixo++;
            chave = $"{chaveBase}{sufixo}";
        }

        return chave;
    }
}