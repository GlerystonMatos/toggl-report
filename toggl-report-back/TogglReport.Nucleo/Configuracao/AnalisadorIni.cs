using System.Text;

namespace RelatorioToggl.Configuracao;

public static class AnalisadorIni
{
    public static Dictionary<string, Dictionary<string, string>> Analisar(string caminho)
    {
        Dictionary<string, Dictionary<string, string>> secoes = new(StringComparer.OrdinalIgnoreCase);
        string secaoAtual = "";

        foreach (string linhaBruta in File.ReadAllLines(caminho))
        {
            string linha = linhaBruta.Trim();

            if (linha.Length == 0 || linha.StartsWith(";") || linha.StartsWith("#"))
                continue;

            if (linha.StartsWith("[") && linha.EndsWith("]"))
            {
                secaoAtual = linha.Substring(1, linha.Length - 2).Trim();
                if (!secoes.ContainsKey(secaoAtual))
                    secoes[secaoAtual] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
                continue;
            }

            int indiceSeparador = linha.IndexOf('=');
            if (indiceSeparador <= 0)
                continue;

            string chave = linha[..indiceSeparador].Trim();
            string valor = linha[(indiceSeparador + 1)..].Trim();

            if (!secoes.ContainsKey(secaoAtual))
                secoes[secaoAtual] = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);

            secoes[secaoAtual][chave] = valor;
        }

        return secoes;
    }

    public static string? ObterOuNulo(Dictionary<string, string> secao, string chave)
        => secao.TryGetValue(chave, out string? valor) ? valor : null;

    public static string ObterOuPadrao(Dictionary<string, string> secao, string chave, string valorPadrao)
        => secao.TryGetValue(chave, out string? valor) ? valor : valorPadrao;

    public static List<string> DividirLista(string? valor)
        => (valor ?? "").Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();

    public static void Escrever(string caminho, string conteudo)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);
        File.WriteAllText(caminho, conteudo, new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }
}