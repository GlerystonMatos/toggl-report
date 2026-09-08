using System.Security.Cryptography;
using System.Text;

namespace RelatorioToggl.Configuracao;

public static class CriptografiaToken
{
    private const string Prefixo = "enc:";

    private const string ChaveEnvVar = "CHAVE_CRIPTOGRAFIA";

    private static readonly byte[] ChavePadrao = SHA256.HashData(
        Encoding.UTF8.GetBytes("TogglReport.ChavePadrao.Configure CHAVE_CRIPTOGRAFIA em producao"));

    public static string Criptografar(string textoPuro)
    {
        if (string.IsNullOrEmpty(textoPuro))
        {
            return textoPuro;
        }

        using Aes aes = Aes.Create();
        aes.Key = ObterChave();
        aes.GenerateIV();

        using MemoryStream memoria = new();
        memoria.Write(aes.IV);
        using (CryptoStream criptoStream = new(memoria, aes.CreateEncryptor(), CryptoStreamMode.Write))
        using (StreamWriter escritor = new(criptoStream, Encoding.UTF8))
        {
            escritor.Write(textoPuro);
        }

        return Prefixo + Convert.ToBase64String(memoria.ToArray());
    }

    public static string Descriptografar(string valorArmazenado)
    {
        if (string.IsNullOrEmpty(valorArmazenado) || !valorArmazenado.StartsWith(Prefixo, StringComparison.Ordinal))
        {
            return valorArmazenado;
        }

        try
        {
            byte[] dados = Convert.FromBase64String(valorArmazenado[Prefixo.Length..]);

            using Aes aes = Aes.Create();
            aes.Key = ObterChave();
            aes.IV = dados[..aes.IV.Length];

            using MemoryStream memoria = new(dados, aes.IV.Length, dados.Length - aes.IV.Length);
            using CryptoStream criptoStream = new(memoria, aes.CreateDecryptor(), CryptoStreamMode.Read);
            using StreamReader leitor = new(criptoStream, Encoding.UTF8);
            return leitor.ReadToEnd();
        }
        catch (Exception excecao) when (excecao is FormatException or CryptographicException)
        {
            return valorArmazenado;
        }
    }

    private static byte[] ObterChave()
    {
        string? chaveConfigurada = Environment.GetEnvironmentVariable(ChaveEnvVar);
        return string.IsNullOrEmpty(chaveConfigurada)
            ? ChavePadrao
            : SHA256.HashData(Encoding.UTF8.GetBytes(chaveConfigurada));
    }
}