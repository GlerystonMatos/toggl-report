using RelatorioToggl.Consultas;

namespace RelatorioToggl.Api.Dtos;

public record ConsultarResponse(string DataInicio, string DataFim, bool VeioDoCache, List<EventoConsultaUsuarioToggl> Usuarios);