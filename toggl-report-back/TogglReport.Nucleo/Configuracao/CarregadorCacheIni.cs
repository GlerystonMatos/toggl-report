using RelatorioToggl.Toggl;
using System.Text;
using System.Text.Json;

namespace RelatorioToggl.Configuracao;

public static class CarregadorCacheIni
{
    private const string SecaoGeral = "Geral";

    private const string PrefixoSecaoUsuario = "Usuario:";

    private static readonly JsonSerializerOptions OpcoesJson = new() { PropertyNameCaseInsensitive = true };

    public static CacheConsulta? Carregar(string caminho)
    {
        if (!File.Exists(caminho))
            return null;

        Dictionary<string, Dictionary<string, string>> secoes = AnalisadorIni.Analisar(caminho);
        CacheConsulta cache = new();

        if (secoes.TryGetValue(SecaoGeral, out Dictionary<string, string>? geral))
        {
            cache.DataInicio = AnalisadorIni.ObterOuPadrao(geral, "DataInicio", "");
            cache.DataFim = AnalisadorIni.ObterOuPadrao(geral, "DataFim", "");
        }

        foreach ((string nomeSecao, Dictionary<string, string> valores) in secoes)
        {
            if (!nomeSecao.StartsWith(PrefixoSecaoUsuario, StringComparison.OrdinalIgnoreCase))
                continue;

            string chave = nomeSecao.Substring(PrefixoSecaoUsuario.Length);
            cache.Usuarios.Add(new UsuarioCacheado
            {
                Chave = chave,
                NomeExibicao = AnalisadorIni.ObterOuPadrao(valores, "NomeExibicao", chave),
                TokenApi = CriptografiaToken.Descriptografar(AnalisadorIni.ObterOuPadrao(valores, "TokenApi", "")),
                Registros = DesserializarRegistros(AnalisadorIni.ObterOuPadrao(valores, "Registros", "[]"))
            });
        }

        return cache;
    }

    public static void Salvar(string caminho, CacheConsulta cache)
    {
        Directory.CreateDirectory(Path.GetDirectoryName(caminho)!);

        StringBuilder sb = new();

        sb.AppendLine($"[{SecaoGeral}]");
        sb.AppendLine($"DataInicio={cache.DataInicio}");
        sb.AppendLine($"DataFim={cache.DataFim}");
        sb.AppendLine();

        foreach (UsuarioCacheado usuario in cache.Usuarios)
        {
            sb.AppendLine($"[{PrefixoSecaoUsuario}{usuario.Chave}]");
            sb.AppendLine($"NomeExibicao={usuario.NomeExibicao}");
            sb.AppendLine($"TokenApi={CriptografiaToken.Criptografar(usuario.TokenApi)}");
            sb.AppendLine($"Registros={JsonSerializer.Serialize(usuario.Registros, OpcoesJson)}");
            sb.AppendLine();
        }

        File.WriteAllText(caminho, sb.ToString(), new UTF8Encoding(encoderShouldEmitUTF8Identifier: false));
    }

    private static List<RegistroTempoDto> DesserializarRegistros(string json)
    {
        try
        {
            return JsonSerializer.Deserialize<List<RegistroTempoDto>>(json, OpcoesJson) ?? new List<RegistroTempoDto>();
        }
        catch (JsonException)
        {
            return new List<RegistroTempoDto>();
        }
    }
}