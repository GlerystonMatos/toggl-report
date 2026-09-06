using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorConfiguracaoIni
{
    private const string SecaoGeral = "Geral";

    private const string PrefixoSecaoUsuario = "Usuario:";

    public static ConfiguracaoApp? Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            return null;

        Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);
        ConfiguracaoApp configuracao = new();

        if (secoes.TryGetValue(SecaoGeral, out Dictionary<string, string>? geral))
        {
            configuracao.DataInicioAnterior = AnalisadorIni.ObterOuNulo(geral, "DataInicioAnterior");
            configuracao.DataFimAnterior = AnalisadorIni.ObterOuNulo(geral, "DataFimAnterior");
            configuracao.AgrupamentoPadrao = AnalisadorIni.ObterOuPadrao(geral, "AgrupamentoPadrao", "ambos");
            configuracao.TagsDetalhadas = AnalisadorIni.ObterOuPadrao(geral, "TagsDetalhadas", "")
                .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                .ToList();
        }

        foreach ((string nomeSecao, Dictionary<string, string> valores) in secoes)
        {
            if (!nomeSecao.StartsWith(PrefixoSecaoUsuario, StringComparison.OrdinalIgnoreCase))
                continue;

            string chave = nomeSecao.Substring(PrefixoSecaoUsuario.Length);
            ConfiguracaoUsuario usuario = new()
            {
                Chave = chave,
                NomeExibicao = AnalisadorIni.ObterOuPadrao(valores, "NomeExibicao", chave),
                TokenApi = AnalisadorIni.ObterOuPadrao(valores, "TokenApi", ""),
                Sigla = AnalisadorIni.ObterOuPadrao(valores, "Sigla", ""),
                Cor = AnalisadorIni.ObterOuPadrao(valores, "Cor", ""),
                Selecionado = bool.TryParse(AnalisadorIni.ObterOuPadrao(valores, "Selecionado", "True"), out bool selecionado) ? selecionado : true
            };
            configuracao.Usuarios.Add(usuario);
        }

        return configuracao;
    }

    public static void Salvar(string caminho, ConfiguracaoApp configuracao)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);

        StringBuilder sb = new();

        sb.AppendLine($"[{SecaoGeral}]");
        sb.AppendLine($"DataInicioAnterior={configuracao.DataInicioAnterior}");
        sb.AppendLine($"DataFimAnterior={configuracao.DataFimAnterior}");
        sb.AppendLine($"AgrupamentoPadrao={configuracao.AgrupamentoPadrao}");
        sb.AppendLine($"TagsDetalhadas={string.Join(",", configuracao.TagsDetalhadas)}");
        sb.AppendLine();

        foreach (ConfiguracaoUsuario usuario in configuracao.Usuarios)
        {
            sb.AppendLine($"[{PrefixoSecaoUsuario}{usuario.Chave}]");
            sb.AppendLine($"NomeExibicao={usuario.NomeExibicao}");
            sb.AppendLine($"TokenApi={usuario.TokenApi}");
            sb.AppendLine($"Sigla={usuario.Sigla}");
            sb.AppendLine($"Cor={usuario.Cor}");
            sb.AppendLine($"Selecionado={usuario.Selecionado}");
            sb.AppendLine();
        }

        File.WriteAllText(caminho, sb.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }
}