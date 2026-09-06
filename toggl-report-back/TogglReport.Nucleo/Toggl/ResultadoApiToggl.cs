namespace RelatorioToggl.Toggl;

public class ResultadoApiToggl<T>
{
    public bool Sucesso { get; private init; }

    public T? Dados { get; private init; }

    public string? MensagemErro { get; private init; }

    public static ResultadoApiToggl<T> Ok(T dados) => new() { Sucesso = true, Dados = dados };

    public static ResultadoApiToggl<T> Falha(string mensagem) => new() { Sucesso = false, MensagemErro = mensagem };
}