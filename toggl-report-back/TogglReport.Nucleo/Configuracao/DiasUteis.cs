namespace RelatorioToggl.Configuracao;

public static class DiasUteis
{
    public static IEnumerable<DateTime> Entre(DateTime inicio, DateTime fim)
    {
        for (DateTime dia = inicio.Date; dia <= fim.Date; dia = dia.AddDays(1))
        {
            if (dia.DayOfWeek is DayOfWeek.Saturday or DayOfWeek.Sunday)
                continue;

            yield return dia;
        }
    }
}