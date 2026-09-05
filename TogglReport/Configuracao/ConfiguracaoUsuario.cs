namespace RelatorioToggl.Configuracao;

/// <summary>Um usuário do config.ini, com seu API Token pessoal do Toggl Track.</summary>
public class ConfiguracaoUsuario
{
    /// <summary>Sufixo da seção no INI (ex.: "joao" em [Usuario:joao]), gerado a partir do nome.</summary>
    public string Chave { get; set; } = "";

    public string NomeExibicao { get; set; } = "";

    public string TokenApi { get; set; } = "";
}