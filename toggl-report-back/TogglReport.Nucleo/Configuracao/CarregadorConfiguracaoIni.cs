using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CarregadorConfiguracaoIni
{
    private const string SecaoGeral = "Geral";

    public static ConfiguracaoApp? Carregar(string caminho, string caminhoUsuarios)
    {
        bool existeConfiguracao = File.Exists(caminho);
        ConfiguracaoApp configuracao = new();

        if (existeConfiguracao)
        {
            Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);

            if (secoes.TryGetValue(SecaoGeral, out Dictionary<string, string>? geral))
            {
                configuracao.DataInicioAnterior = AnalisadorIni.ObterOuNulo(geral, "DataInicioAnterior");
                configuracao.DataFimAnterior = AnalisadorIni.ObterOuNulo(geral, "DataFimAnterior");
                configuracao.AgrupamentoPadrao = AnalisadorIni.ObterOuPadrao(geral, "AgrupamentoPadrao", "ambos");
                configuracao.TagsDetalhadas = AnalisadorIni.ObterOuPadrao(geral, "TagsDetalhadas", "")
                    .Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
                    .ToList();
            }
        }

        configuracao.Usuarios = CarregadorUsuariosIni.Carregar(caminhoUsuarios, caminhoMigracaoLegado: caminho);

        return existeConfiguracao || configuracao.Usuarios.Count > 0 ? configuracao : null;
    }

    public static void Salvar(string caminho, string caminhoUsuarios, ConfiguracaoApp configuracao)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);

        StringBuilder sb = new();
        sb.AppendLine($"[{SecaoGeral}]");
        sb.AppendLine($"DataInicioAnterior={configuracao.DataInicioAnterior}");
        sb.AppendLine($"DataFimAnterior={configuracao.DataFimAnterior}");
        sb.AppendLine($"AgrupamentoPadrao={configuracao.AgrupamentoPadrao}");
        sb.AppendLine($"TagsDetalhadas={string.Join(",", configuracao.TagsDetalhadas)}");

        File.WriteAllText(caminho, sb.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));

        CarregadorUsuariosIni.Salvar(caminhoUsuarios, configuracao.Usuarios);
    }
}