namespace RelatorioToggl.Consultas;

public record EventoConsultaUsuario(string NomeUsuario, StatusConsultaUsuario Status, string? Mensagem, int? QuantidadeRegistros);