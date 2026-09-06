using System.Net;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;

namespace RelatorioToggl.Toggl;

public class ClienteApiToggl
{
    private const string UrlBase = "https://api.track.toggl.com/api/v9/";

    private static readonly JsonSerializerOptions OpcoesJson = new()
    {
        PropertyNameCaseInsensitive = true
    };

    private readonly HttpClient _http;

    public ClienteApiToggl(string tokenApi)
    {
        _http = new HttpClient { BaseAddress = new Uri(UrlBase), Timeout = TimeSpan.FromSeconds(30) };

        byte[] bytesAutenticacao = Encoding.ASCII.GetBytes($"{tokenApi}:api_token");
        string valorCabecalhoAutenticacao = Convert.ToBase64String(bytesAutenticacao);

        _http.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Basic", valorCabecalhoAutenticacao);
        _http.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
    }

    public async Task<bool> ValidarTokenAsync()
    {
        try
        {
            using HttpResponseMessage resposta = await _http.GetAsync("me");
            return resposta.IsSuccessStatusCode;
        }
        catch
        {
            return false;
        }
    }

    public async Task<ResultadoApiToggl<List<RegistroTempoDto>>> ObterRegistrosTempoAsync(DateTime inicioUtc, DateTime fimUtc, bool ehNovaTentativa = false)
    {
        string inicio = Uri.EscapeDataString(inicioUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"));
        string fim = Uri.EscapeDataString(fimUtc.ToString("yyyy-MM-ddTHH:mm:ssZ"));
        string url = $"me/time_entries?start_date={inicio}&end_date={fim}";

        HttpResponseMessage resposta;

        try
        {
            resposta = await _http.GetAsync(url);
        }
        catch (Exception ex)
        {
            return ResultadoApiToggl<List<RegistroTempoDto>>.Falha($"Erro de rede: {ex.Message}");
        }

        using (resposta)
        {
            if (resposta.StatusCode == HttpStatusCode.TooManyRequests && !ehNovaTentativa)
            {
                TimeSpan aguardarNovamente = resposta.Headers.RetryAfter?.Delta ?? TimeSpan.FromSeconds(5);
                await Task.Delay(aguardarNovamente);
                return await ObterRegistrosTempoAsync(inicioUtc, fimUtc, ehNovaTentativa: true);
            }

            if (resposta.StatusCode == HttpStatusCode.Unauthorized)
                return ResultadoApiToggl<List<RegistroTempoDto>>.Falha("Token inválido ou expirado (401 Unauthorized).");

            if (!resposta.IsSuccessStatusCode)
            {
                string corpo = await resposta.Content.ReadAsStringAsync();
                return ResultadoApiToggl<List<RegistroTempoDto>>.Falha($"Erro {(int)resposta.StatusCode} ({resposta.StatusCode}): {corpo}");
            }

            string json = await resposta.Content.ReadAsStringAsync();

            try
            {
                List<RegistroTempoDto> registros = JsonSerializer.Deserialize<List<RegistroTempoDto>>(json, OpcoesJson) ?? new List<RegistroTempoDto>();
                return ResultadoApiToggl<List<RegistroTempoDto>>.Ok(registros);
            }
            catch (JsonException ex)
            {
                return ResultadoApiToggl<List<RegistroTempoDto>>.Falha($"Erro ao interpretar resposta da API: {ex.Message}");
            }
        }
    }
}