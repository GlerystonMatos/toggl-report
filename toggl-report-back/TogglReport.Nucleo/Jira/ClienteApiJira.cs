using System.Globalization;
using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace RelatorioToggl.Jira;

public class ClienteApiJira
{
    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _http;

    private readonly string _urlBaseSite;

    public ClienteApiJira(string urlDominio, string email, string apiToken)
    {
        _urlBaseSite = NormalizarDominio(urlDominio);
        _http = new HttpClient { BaseAddress = new Uri($"{_urlBaseSite}/rest/api/3/"), Timeout = TimeSpan.FromSeconds(30) };

        byte[] bytesAutenticacao = Encoding.UTF8.GetBytes($"{email}:{apiToken}");
        string valorCabecalhoAutenticacao = Convert.ToBase64String(bytesAutenticacao);

        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", valorCabecalhoAutenticacao);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<ResultadoApiJira<bool>> TestarConexaoAsync()
    {
        try
        {
            using HttpResponseMessage resposta = await _http.GetAsync("myself");

            if (resposta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return ResultadoApiJira<bool>.Falha("Credenciais inválidas (e-mail ou API Token incorretos).");

            if (!resposta.IsSuccessStatusCode)
            {
                string corpo = await resposta.Content.ReadAsStringAsync();
                return ResultadoApiJira<bool>.Falha($"Erro {(int)resposta.StatusCode} ao conectar ao Jira: {corpo}");
            }

            return ResultadoApiJira<bool>.Ok(true);
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return ResultadoApiJira<bool>.Falha($"Não foi possível conectar ao Jira: {ex.Message}");
        }
    }

    public async Task<ResultadoApiJira<List<CampoJira>>> ObterCamposAsync()
    {
        try
        {
            using HttpResponseMessage resposta = await _http.GetAsync("field");

            if (resposta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return ResultadoApiJira<List<CampoJira>>.Falha("Credenciais inválidas (e-mail ou API Token incorretos).");

            if (!resposta.IsSuccessStatusCode)
            {
                string corpo = await resposta.Content.ReadAsStringAsync();
                return ResultadoApiJira<List<CampoJira>>.Falha($"Erro {(int)resposta.StatusCode} ao consultar campos do Jira: {corpo}");
            }

            string json = await resposta.Content.ReadAsStringAsync();
            List<CampoJiraBruto>? camposBrutos = JsonSerializer.Deserialize<List<CampoJiraBruto>>(json, OpcoesJson);

            List<CampoJira> campos = (camposBrutos ?? new List<CampoJiraBruto>())
                .Where(campo => campo.Custom)
                .Select(campo => new CampoJira(campo.Id, campo.Name))
                .OrderBy(campo => campo.Nome, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return ResultadoApiJira<List<CampoJira>>.Ok(campos);
        }
        catch (JsonException ex)
        {
            return ResultadoApiJira<List<CampoJira>>.Falha($"Erro ao interpretar resposta do Jira: {ex.Message}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return ResultadoApiJira<List<CampoJira>>.Falha($"Não foi possível conectar ao Jira: {ex.Message}");
        }
    }

    public async Task<ResultadoApiJira<List<string>>> ObterStatusAsync() => await ObterNomesAsync("status");

    public async Task<ResultadoApiJira<List<string>>> ObterPrioridadesAsync() => await ObterNomesAsync("priority");

    private async Task<ResultadoApiJira<List<string>>> ObterNomesAsync(string recurso)
    {
        try
        {
            using HttpResponseMessage resposta = await _http.GetAsync(recurso);

            if (resposta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                return ResultadoApiJira<List<string>>.Falha("Credenciais inválidas (e-mail ou API Token incorretos).");

            if (!resposta.IsSuccessStatusCode)
            {
                string corpo = await resposta.Content.ReadAsStringAsync();
                return ResultadoApiJira<List<string>>.Falha($"Erro {(int)resposta.StatusCode} ao consultar {recurso} do Jira: {corpo}");
            }

            string json = await resposta.Content.ReadAsStringAsync();
            List<NomeObjetoJiraBruto>? brutos = JsonSerializer.Deserialize<List<NomeObjetoJiraBruto>>(json, OpcoesJson);

            List<string> nomes = (brutos ?? new List<NomeObjetoJiraBruto>())
                .Select(item => item.Name)
                .Where(nome => !string.IsNullOrWhiteSpace(nome))
                .Select(nome => nome!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(nome => nome, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return ResultadoApiJira<List<string>>.Ok(nomes);
        }
        catch (JsonException ex)
        {
            return ResultadoApiJira<List<string>>.Falha($"Erro ao interpretar resposta do Jira: {ex.Message}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return ResultadoApiJira<List<string>>.Falha($"Não foi possível conectar ao Jira: {ex.Message}");
        }
    }

    public async Task<ResultadoApiJira<List<string>>> ObterUsuariosAsync()
    {
        const int tamanhoPagina = 50;
        List<UsuarioJiraBruto> usuariosBrutos = new();
        int startAt = 0;

        try
        {
            while (true)
            {
                using HttpResponseMessage resposta = await _http.GetAsync($"users/search?startAt={startAt}&maxResults={tamanhoPagina}");

                if (resposta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                    return ResultadoApiJira<List<string>>.Falha("Credenciais inválidas (e-mail ou API Token incorretos).");

                if (!resposta.IsSuccessStatusCode)
                {
                    string corpo = await resposta.Content.ReadAsStringAsync();
                    return ResultadoApiJira<List<string>>.Falha($"Erro {(int)resposta.StatusCode} ao consultar usuários do Jira: {corpo}");
                }

                string json = await resposta.Content.ReadAsStringAsync();
                List<UsuarioJiraBruto>? pagina = JsonSerializer.Deserialize<List<UsuarioJiraBruto>>(json, OpcoesJson);

                if (pagina is null || pagina.Count == 0)
                    break;

                usuariosBrutos.AddRange(pagina);

                if (pagina.Count < tamanhoPagina)
                    break;

                startAt += tamanhoPagina;
            }

            List<string> nomes = usuariosBrutos
                .Where(usuario => usuario.Active && string.Equals(usuario.AccountType, "atlassian", StringComparison.OrdinalIgnoreCase))
                .Select(usuario => usuario.DisplayName)
                .Where(nome => !string.IsNullOrWhiteSpace(nome))
                .Select(nome => nome!)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .OrderBy(nome => nome, StringComparer.OrdinalIgnoreCase)
                .ToList();

            return ResultadoApiJira<List<string>>.Ok(nomes);
        }
        catch (JsonException ex)
        {
            return ResultadoApiJira<List<string>>.Falha($"Erro ao interpretar resposta do Jira: {ex.Message}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return ResultadoApiJira<List<string>>.Falha($"Não foi possível conectar ao Jira: {ex.Message}");
        }
    }

    public async Task<ResultadoApiJira<List<IssueJira>>> BuscarIssuesAsync(List<string> chaves, string campoEstimativaDesenvolvimentoId, string? campoRevisadoPorId = null, string? campoEstimativaRevisaoId = null, string? campoEstimativaTestesId = null)
    {
        if (chaves.Count == 0)
            return ResultadoApiJira<List<IssueJira>>.Ok(new List<IssueJira>());

        List<string> camposDesejados = new() { "priority", "status", "assignee" };
        if (!string.IsNullOrWhiteSpace(campoEstimativaDesenvolvimentoId))
            camposDesejados.Add(campoEstimativaDesenvolvimentoId);
        if (!string.IsNullOrWhiteSpace(campoRevisadoPorId))
            camposDesejados.Add(campoRevisadoPorId);
        if (!string.IsNullOrWhiteSpace(campoEstimativaRevisaoId))
            camposDesejados.Add(campoEstimativaRevisaoId);
        if (!string.IsNullOrWhiteSpace(campoEstimativaTestesId))
            camposDesejados.Add(campoEstimativaTestesId);

        string jql = $"key in ({string.Join(",", chaves)})";
        List<IssueBrutaJira> issuesBrutas = new();
        string? proximoPageToken = null;

        try
        {
            bool ultimaPagina;
            do
            {
                object corpo = proximoPageToken is null
                    ? new { jql, fields = camposDesejados, maxResults = 100 }
                    : new { jql, fields = camposDesejados, maxResults = 100, nextPageToken = proximoPageToken };

                using StringContent conteudo = new(JsonSerializer.Serialize(corpo), Encoding.UTF8, "application/json");
                using HttpResponseMessage resposta = await _http.PostAsync("search/jql", conteudo);

                if (resposta.StatusCode is HttpStatusCode.Unauthorized or HttpStatusCode.Forbidden)
                    return ResultadoApiJira<List<IssueJira>>.Falha("Credenciais inválidas (e-mail ou API Token incorretos).");

                if (!resposta.IsSuccessStatusCode)
                {
                    string corpoErro = await resposta.Content.ReadAsStringAsync();
                    return ResultadoApiJira<List<IssueJira>>.Falha($"Erro {(int)resposta.StatusCode} ao buscar issues do Jira: {corpoErro}");
                }

                string json = await resposta.Content.ReadAsStringAsync();
                RespostaBuscaJiraBruta? respostaBruta = JsonSerializer.Deserialize<RespostaBuscaJiraBruta>(json, OpcoesJson);

                if (respostaBruta?.Issues is not null)
                    issuesBrutas.AddRange(respostaBruta.Issues);

                proximoPageToken = respostaBruta?.NextPageToken;
                ultimaPagina = respostaBruta is null || respostaBruta.IsLast || string.IsNullOrWhiteSpace(proximoPageToken);
            }
            while (!ultimaPagina);

            List<IssueJira> issues = issuesBrutas
                .Select(issue => new IssueJira(
                    issue.Key,
                    issue.Fields.Priority?.Name,
                    issue.Fields.Status?.Name,
                    ExtrairEstimativaEsforco(issue.Fields.CamposExtras, campoEstimativaDesenvolvimentoId),
                    MontarUrlIssue(issue.Key),
                    issue.Fields.Status?.StatusCategory?.Key,
                    ExtrairNomeUsuario(issue.Fields.CamposExtras, "assignee"),
                    ExtrairNomeUsuario(issue.Fields.CamposExtras, campoRevisadoPorId),
                    ExtrairEstimativaEsforco(issue.Fields.CamposExtras, campoEstimativaRevisaoId ?? ""),
                    ExtrairEstimativaEsforco(issue.Fields.CamposExtras, campoEstimativaTestesId ?? "")))
                .ToList();

            return ResultadoApiJira<List<IssueJira>>.Ok(issues);
        }
        catch (JsonException ex)
        {
            return ResultadoApiJira<List<IssueJira>>.Falha($"Erro ao interpretar resposta do Jira: {ex.Message}");
        }
        catch (Exception ex) when (ex is HttpRequestException or TaskCanceledException or UriFormatException)
        {
            return ResultadoApiJira<List<IssueJira>>.Falha($"Não foi possível conectar ao Jira: {ex.Message}");
        }
    }

    private static decimal? ExtrairEstimativaEsforco(Dictionary<string, JsonElement>? camposExtras, string campoEstimativaEsforcoId)
    {
        if (string.IsNullOrWhiteSpace(campoEstimativaEsforcoId)
            || camposExtras is null
            || !camposExtras.TryGetValue(campoEstimativaEsforcoId, out JsonElement valor)
            || valor.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;

        if (valor.ValueKind == JsonValueKind.Number && valor.TryGetDecimal(out decimal numero))
            return numero;

        if (valor.ValueKind == JsonValueKind.String && decimal.TryParse(valor.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out decimal numeroTexto))
            return numeroTexto;

        if (valor.ValueKind == JsonValueKind.Object && valor.TryGetProperty("value", out JsonElement valorAninhado))
        {
            if (valorAninhado.ValueKind == JsonValueKind.Number && valorAninhado.TryGetDecimal(out decimal numeroAninhado))
                return numeroAninhado;

            if (valorAninhado.ValueKind == JsonValueKind.String && decimal.TryParse(valorAninhado.GetString(), NumberStyles.Any, CultureInfo.InvariantCulture, out decimal numeroAninhadoTexto))
                return numeroAninhadoTexto;
        }

        return null;
    }

    private static string? ExtrairNomeUsuario(Dictionary<string, JsonElement>? camposExtras, string? chaveCampo)
    {
        if (string.IsNullOrWhiteSpace(chaveCampo)
            || camposExtras is null
            || !camposExtras.TryGetValue(chaveCampo, out JsonElement valor)
            || valor.ValueKind is JsonValueKind.Null or JsonValueKind.Undefined)
            return null;

        if (valor.ValueKind == JsonValueKind.Object
            && valor.TryGetProperty("displayName", out JsonElement nome)
            && nome.ValueKind == JsonValueKind.String)
            return nome.GetString();

        return null;
    }

    private static string NormalizarDominio(string urlDominio)
    {
        string dominio = urlDominio.Trim().TrimEnd('/');
        if (!dominio.StartsWith("http://", StringComparison.OrdinalIgnoreCase) && !dominio.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            dominio = $"https://{dominio}";

        return dominio;
    }

    private string MontarUrlIssue(string chave) => $"{_urlBaseSite}/browse/{chave}";
}