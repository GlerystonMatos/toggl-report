namespace RelatorioToggl.Configuracao;

public static class ServicoUsuarios
{
    public static bool NomeEmUso(List<ConfiguracaoUsuario> usuarios, string nome, ConfiguracaoUsuario? ignorar)
        => usuarios.Any(u => u != ignorar && u.NomeExibicao.Equals(nome, StringComparison.OrdinalIgnoreCase));

    public static bool TokenEmUso(List<ConfiguracaoUsuario> usuarios, string token, ConfiguracaoUsuario? ignorar)
        => usuarios.Any(u => u != ignorar && u.TokenApi.Equals(token, StringComparison.Ordinal));

    public static bool SiglaEmUso(List<ConfiguracaoUsuario> usuarios, string sigla, ConfiguracaoUsuario? ignorar)
        => usuarios.Any(u => u != ignorar && u.Sigla.Length > 0 && u.Sigla.Equals(sigla, StringComparison.OrdinalIgnoreCase));

    public static string GerarChaveUnica(string nome, List<ConfiguracaoUsuario> usuariosExistentes)
        => ServicoChaves.GerarChaveUnica(nome, usuariosExistentes.Select(u => u.Chave), "usuario");

    public static string MascararToken(string token)
    {
        if (string.IsNullOrEmpty(token) || token.Length < 8)
            return "****";

        return $"{token[..4]}...{token[^4..]}";
    }
}