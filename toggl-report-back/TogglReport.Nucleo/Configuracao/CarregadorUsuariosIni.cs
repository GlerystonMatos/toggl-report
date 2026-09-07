using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorUsuariosIni
{
    private const string PrefixoSecaoUsuario = "Usuario:";

    public static List<ConfiguracaoUsuario> Carregar(string caminho, string? caminhoMigracaoLegado = null)
    {
        if (!File.Exists(caminho) && caminhoMigracaoLegado is not null && File.Exists(caminhoMigracaoLegado))
        {
            List<ConfiguracaoUsuario> usuariosLegado = ExtrairUsuarios(AnalisadorIni.Analisar(caminhoMigracaoLegado));
            if (usuariosLegado.Count > 0)
            {
                try
                {
                    Salvar(caminho, usuariosLegado);
                }
                catch (Exception excecao) when (excecao is IOException or UnauthorizedAccessException)
                {
                }

                return usuariosLegado;
            }
        }

        return File.Exists(caminho) ? ExtrairUsuarios(AnalisadorIni.Analisar(caminho)) : new List<ConfiguracaoUsuario>();
    }

    public static void Salvar(string caminho, List<ConfiguracaoUsuario> usuarios)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);

        StringBuilder sb = new();

        foreach (ConfiguracaoUsuario usuario in usuarios)
        {
            sb.AppendLine($"[{PrefixoSecaoUsuario}{usuario.Chave}]");
            sb.AppendLine($"NomeExibicao={usuario.NomeExibicao}");
            sb.AppendLine($"TokenApi={CriptografiaToken.Criptografar(usuario.TokenApi)}");
            sb.AppendLine($"Sigla={usuario.Sigla}");
            sb.AppendLine($"Cor={usuario.Cor}");
            sb.AppendLine($"Selecionado={usuario.Selecionado}");
            sb.AppendLine();
        }

        File.WriteAllText(caminho, sb.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }

    private static List<ConfiguracaoUsuario> ExtrairUsuarios(Dictionary<string, Dictionary<string, string>> secoes)
    {
        List<ConfiguracaoUsuario> usuarios = new();

        foreach ((string nomeSecao, Dictionary<string, string> valores) in secoes)
        {
            if (!nomeSecao.StartsWith(PrefixoSecaoUsuario, StringComparison.OrdinalIgnoreCase))
                continue;

            string chave = nomeSecao.Substring(PrefixoSecaoUsuario.Length);
            usuarios.Add(new ConfiguracaoUsuario
            {
                Chave = chave,
                NomeExibicao = AnalisadorIni.ObterOuPadrao(valores, "NomeExibicao", chave),
                TokenApi = CriptografiaToken.Descriptografar(AnalisadorIni.ObterOuPadrao(valores, "TokenApi", "")),
                Sigla = AnalisadorIni.ObterOuPadrao(valores, "Sigla", ""),
                Cor = AnalisadorIni.ObterOuPadrao(valores, "Cor", ""),
                Selecionado = bool.TryParse(AnalisadorIni.ObterOuPadrao(valores, "Selecionado", "True"), out bool selecionado) ? selecionado : true
            });
        }

        return usuarios;
    }
}