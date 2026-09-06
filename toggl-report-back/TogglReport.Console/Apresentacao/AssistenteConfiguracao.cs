using RelatorioToggl.Configuracao;
using System.Globalization;

namespace RelatorioToggl.Apresentacao;

public sealed class AssistenteConfiguracao
{
    private readonly string _versao;

    public AssistenteConfiguracao(string versao) => _versao = versao;

    public async Task<(DateTime inicio, DateTime fim)> ColetarAsync(ConfiguracaoApp atual, ConfiguracaoApp? salvos)
    {
        atual.Usuarios = salvos is null ? new() : new(salvos.Usuarios);

        atual.AgrupamentoPadrao = LerAgrupamento(atual, salvos?.AgrupamentoPadrao);
        atual.TagsDetalhadas = atual.AgrupamentoPadrao is "tag" or "ambos"
            ? LerTagsDetalhadas(atual, salvos?.TagsDetalhadas)
            : new List<string>(salvos?.TagsDetalhadas ?? new List<string>());

        await GerenciarUsuariosAsync(atual);
        return LerPeriodo(atual, salvos);
    }

    private string LerAgrupamento(ConfiguracaoApp atual, string? salvo)
    {
        if (PodeReaproveitar(atual, "agrupamento", salvo, EhAgrupamentoValido, Rotulos.Agrupamento))
            return salvo!;

        return LerCampo(atual, "agrupamento", "Informe o agrupamento:",
            validar: v => EhAgrupamentoValido(v) ? null : "Agrupamento inválido. Escolha um da lista.",
            descrever: Rotulos.Agrupamento,
            opcoes: new[] { "descricao - Por descrição", "tag - Por tag", "ambos - Ambos" });
    }

    private List<string> LerTagsDetalhadas(ConfiguracaoApp atual, List<string>? salvo)
    {
        if (salvo is { Count: > 0 } && OfereceValorSalvo(atual, "tags detalhadas", string.Join(", ", salvo)))
            return new List<string>(salvo);

        string valor = LerCampo(atual, "tags detalhadas",
            "Informe as tags que NÃO devem aparecer na listagem por tag (separadas por vírgula, Enter = nenhuma):",
            validar: _ => null,
            descrever: DescreverTags);

        return ProcessarTags(valor);
    }

    private static string DescreverTags(string valor)
    {
        List<string> tags = ProcessarTags(valor);
        return tags.Count == 0 ? "nenhuma" : string.Join(", ", tags);
    }

    private static List<string> ProcessarTags(string valor) =>
        valor.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries)
            .Distinct(StringComparer.OrdinalIgnoreCase)
            .ToList();

    private async Task GerenciarUsuariosAsync(ConfiguracaoApp atual)
    {
        Tela.Cabecalho(_versao, atual);

        if (atual.Usuarios.Count == 0 || Prompt.Confirmar("\n Gerenciar usuários/tokens?"))
            await MenuTokenUsuario.GerenciarUsuariosAsync(_versao, atual);

        while (atual.Usuarios.Count == 0)
        {
            Tela.Cabecalho(_versao, atual);
            Paleta.EscreverLinha("\n É necessário cadastrar ao menos um usuário.", Paleta.Erro);
            await MenuTokenUsuario.GerenciarUsuariosAsync(_versao, atual);
        }
    }

    private (DateTime inicio, DateTime fim) LerPeriodo(ConfiguracaoApp atual, ConfiguracaoApp? salvos)
    {
        DateTime padraoInicio = DataOu(salvos?.DataInicioAnterior, DateTime.Today.AddDays(-30));
        DateTime padraoFim = DataOu(salvos?.DataFimAnterior, DateTime.Today);

        DateTime inicio = LerData(atual, "data início", salvos?.DataInicioAnterior, padraoInicio);
        DateTime fim = LerData(atual, "data fim", salvos?.DataFimAnterior, padraoFim < inicio ? inicio : padraoFim);

        while (fim < inicio)
        {
            Tela.Cabecalho(_versao, atual);
            Paleta.EscreverLinha("\n A data fim não pode ser anterior à data início.", Paleta.Erro);
            fim = LerData(atual, "data fim", null, inicio);
        }

        return (inicio, fim);
    }

    private const string FormatoData = "dd/MM/yyyy";

    private DateTime LerData(ConfiguracaoApp atual, string rotulo, string? salvo, DateTime padrao)
    {
        if (DateTime.TryParse(salvo, out DateTime guardada) &&
            OfereceValorSalvo(atual, rotulo, Rotulos.Data(guardada)))
            return guardada.Date;

        string valor = LerCampo(atual, rotulo, $"Informe a {rotulo} (DD/MM/AAAA, Enter = {Rotulos.Data(padrao)}):",
            validar: v => v.Length == 0 || DateTime.TryParseExact(v, FormatoData, CultureInfo.InvariantCulture, DateTimeStyles.None, out _)
                ? null
                : "Data inválida. Use DD/MM/AAAA.",
            descrever: v => Rotulos.Data(v.Length == 0 ? padrao : DateTime.ParseExact(v, FormatoData, CultureInfo.InvariantCulture)));

        return (valor.Length == 0 ? padrao : DateTime.ParseExact(valor, FormatoData, CultureInfo.InvariantCulture)).Date;
    }

    private string LerCampo(ConfiguracaoApp atual, string rotulo, string instrucao, Func<string, string?> validar, Func<string, string> descrever, IEnumerable<string>? opcoes = null, int colunas = 1)
    {
        string? aviso = null;

        while (true)
        {
            Tela.Cabecalho(_versao, atual);
            if (aviso is not null)
                Paleta.EscreverLinha($"\n {aviso}", Paleta.Erro);

            string entrada = opcoes is null
                ? Prompt.Perguntar($"\n {instrucao}")
                : Prompt.EscolherOpcao($"\n {instrucao}", opcoes, colunas);

            string? erro = validar(entrada);
            if (erro is not null)
            {
                aviso = erro;
                continue;
            }

            Tela.Cabecalho(_versao, atual);
            if (Prompt.Confirmar($"\n Confirmar {rotulo}: {descrever(entrada)}?"))
                return entrada;

            aviso = "Valor descartado. Informe novamente.";
        }
    }

    private bool PodeReaproveitar(ConfiguracaoApp atual, string rotulo, string? salvo, Func<string, bool> valido, Func<string, string> descrever)
        => !string.IsNullOrWhiteSpace(salvo) && valido(salvo) && OfereceValorSalvo(atual, rotulo, descrever(salvo));

    private bool OfereceValorSalvo(ConfiguracaoApp atual, string rotulo, string descricao)
    {
        Tela.Cabecalho(_versao, atual);
        Paleta.EscreverLinha("\n Foram encontrados dados salvos da última execução.", Paleta.Info);
        return Prompt.Confirmar($"\n Reaproveitar {rotulo} ({descricao})?", padraoSim: true);
    }

    private static bool EhAgrupamentoValido(string valor) => valor is "descricao" or "tag" or "ambos";

    private static DateTime DataOu(string? texto, DateTime padrao) =>
        DateTime.TryParse(texto, out DateTime data) ? data : padrao;
}