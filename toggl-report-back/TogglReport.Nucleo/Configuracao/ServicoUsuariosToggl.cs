namespace RelatorioToggl.Configuracao;

public static class ServicoUsuariosToggl
{
    public static bool NomeEmUso(List<ConfiguracaoUsuarioToggl> usuarios, string nome, ConfiguracaoUsuarioToggl? ignorar)
        => usuarios.Any(u => u != ignorar && u.NomeExibicao.Equals(nome, StringComparison.OrdinalIgnoreCase));

    public static bool TokenEmUso(List<ConfiguracaoUsuarioToggl> usuarios, string token, ConfiguracaoUsuarioToggl? ignorar)
        => usuarios.Any(u => u != ignorar && u.TokenApi.Equals(token, StringComparison.Ordinal));

    public static bool SiglaEmUso(List<ConfiguracaoUsuarioToggl> usuarios, string sigla, ConfiguracaoUsuarioToggl? ignorar)
        => usuarios.Any(u => u != ignorar && u.Sigla.Length > 0 && u.Sigla.Equals(sigla, StringComparison.OrdinalIgnoreCase));

    public static string GerarChaveUnica(string nome, List<ConfiguracaoUsuarioToggl> usuariosExistentes)
        => ServicoChaves.GerarChaveUnica(nome, usuariosExistentes.Select(u => u.Chave), "usuario");

    public static string MascararToken(string token)
    {
        if (string.IsNullOrEmpty(token) || token.Length < 8)
            return "****";

        return $"{token[..4]}...{token[^4..]}";
    }
}