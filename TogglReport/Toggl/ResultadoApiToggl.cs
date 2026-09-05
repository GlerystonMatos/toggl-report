namespace RelatorioToggl.Toggl;

/// <summary>Envelope de resultado da API, evitando exceptions para erros esperados (401, 429, rede).</summary>
public class ResultadoApiToggl<T>
{
    public bool Sucesso { get; private init; }

    public T? Dados { get; private init; }

    public string? MensagemErro { get; private init; }

    public static ResultadoApiToggl<T> Ok(T dados) => new() { Sucesso = true, Dados = dados };

    public static ResultadoApiToggl<T> Falha(string mensagem) => new() { Sucesso = false, MensagemErro = mensagem };
}