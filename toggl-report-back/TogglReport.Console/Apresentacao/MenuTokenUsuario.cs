using RelatorioToggl.Configuracao;
using RelatorioToggl.Toggl;

namespace RelatorioToggl.Apresentacao;

public static class MenuTokenUsuario
{
    public static async Task GerenciarUsuariosAsync(string versao, ConfiguracaoApp configuracao)
    {
        List<ConfiguracaoUsuario> usuarios = configuracao.Usuarios;

        while (true)
        {
            Tela.Cabecalho(versao, configuracao);
            ListarUsuarios(usuarios);

            Console.WriteLine();
            Paleta.EscreverLinha(" O que deseja fazer?", Paleta.Neutro);
            Paleta.EscreverLinha("   [A] Adicionar   [R] Remover   [E] Editar   [C] Concluir", Paleta.Info);

            string escolha = Prompt.Perguntar("\n Escolha:").ToUpperInvariant();

            switch (escolha)
            {
                case "A":
                    await AdicionarUsuarioAsync(usuarios);
                    break;
                case "R":
                    RemoverUsuario(usuarios);
                    break;
                case "E":
                    await EditarUsuarioAsync(usuarios);
                    break;
                case "C":
                    return;
                default:
                    Paleta.EscreverLinha(" Opção inválida. Escolha A, R, E ou C.", Paleta.Erro);
                    Pausar();
                    break;
            }
        }
    }

    private static void ListarUsuarios(List<ConfiguracaoUsuario> usuarios)
    {
        Console.WriteLine();
        Paleta.EscreverLinha(" Usuários cadastrados:", Paleta.Neutro);

        if (usuarios.Count == 0)
        {
            Paleta.EscreverLinha("   (nenhum usuário cadastrado ainda)", Paleta.Info);
            return;
        }

        for (int i = 0; i < usuarios.Count; i++)
            Paleta.EscreverLinha($"   {i + 1}. {usuarios[i].NomeExibicao}  (token: {ServicoUsuarios.MascararToken(usuarios[i].TokenApi)})", Paleta.Info);
    }

    private static async Task AdicionarUsuarioAsync(List<ConfiguracaoUsuario> usuarios)
    {
        string nome = Prompt.Perguntar("\n Nome de exibição:");
        if (string.IsNullOrWhiteSpace(nome))
        {
            Paleta.EscreverLinha(" Nome inválido. Operação cancelada.", Paleta.Erro);
            Pausar();
            return;
        }

        if (ServicoUsuarios.NomeEmUso(usuarios, nome, ignorar: null))
        {
            Paleta.EscreverLinha($" Já existe um usuário chamado '{nome}'.", Paleta.Erro);
            Pausar();
            return;
        }

        string? token = await PerguntarEValidarTokenAsync();
        if (token is null)
        {
            Paleta.EscreverLinha(" Cadastro cancelado.", Paleta.Erro);
            Pausar();
            return;
        }

        string chave = ServicoUsuarios.GerarChaveUnica(nome, usuarios);
        usuarios.Add(new ConfiguracaoUsuario { Chave = chave, NomeExibicao = nome, TokenApi = token });
        Paleta.EscreverLinha($" Usuário '{nome}' adicionado.", Paleta.Sucesso);
        Pausar();
    }

    private static void RemoverUsuario(List<ConfiguracaoUsuario> usuarios)
    {
        if (usuarios.Count == 0)
        {
            Paleta.EscreverLinha(" Não há usuários para remover.", Paleta.Erro);
            Pausar();
            return;
        }

        int? indice = PerguntarIndiceUsuario(usuarios, "remover");
        if (indice is null)
            return;

        ConfiguracaoUsuario usuario = usuarios[indice.Value];
        Paleta.EscreverLinha("", Paleta.Sucesso);

        if (Prompt.Confirmar($" Confirma remoção de '{usuario.NomeExibicao}'?"))
        {
            usuarios.RemoveAt(indice.Value);
            Paleta.EscreverLinha(" Usuário removido.", Paleta.Sucesso);
        }
        else
        {
            Paleta.EscreverLinha(" Remoção cancelada.", Paleta.Info);
        }
        Pausar();
    }

    private static async Task EditarUsuarioAsync(List<ConfiguracaoUsuario> usuarios)
    {
        if (usuarios.Count == 0)
        {
            Paleta.EscreverLinha(" Não há usuários para editar.", Paleta.Erro);
            Pausar();
            return;
        }

        int? indice = PerguntarIndiceUsuario(usuarios, "editar");
        if (indice is null)
            return;

        ConfiguracaoUsuario usuario = usuarios[indice.Value];

        string nome = Prompt.Perguntar($" Nome de exibição [{usuario.NomeExibicao}]:");
        if (!string.IsNullOrWhiteSpace(nome))
        {
            if (ServicoUsuarios.NomeEmUso(usuarios, nome, ignorar: usuario))
                Paleta.EscreverLinha($" Já existe um usuário chamado '{nome}'. Nome mantido.", Paleta.Erro);
            else
                usuario.NomeExibicao = nome;
        }

        Paleta.EscreverLinha("", Paleta.Sucesso);
        if (Prompt.Confirmar(" Alterar o API Token?"))
        {
            string? token = await PerguntarEValidarTokenAsync();
            if (token is not null)
                usuario.TokenApi = token;
        }

        Paleta.EscreverLinha(" Usuário atualizado.", Paleta.Sucesso);
        Pausar();
    }

    private static int? PerguntarIndiceUsuario(List<ConfiguracaoUsuario> usuarios, string acao)
    {
        string entrada = Prompt.Perguntar($" Número do usuário a {acao}:");
        if (int.TryParse(entrada, out int numero) && numero >= 1 && numero <= usuarios.Count)
            return numero - 1;

        Paleta.EscreverLinha(" Número inválido.", Paleta.Erro);
        Pausar();
        return null;
    }

    private static async Task<string?> PerguntarEValidarTokenAsync()
    {
        while (true)
        {
            string token = Prompt.Perguntar(" API Token (em Profile Settings no Toggl):");

            if (string.IsNullOrWhiteSpace(token))
            {
                Paleta.EscreverLinha(" Token vazio. Operação cancelada.", Paleta.Erro);
                return null;
            }

            Paleta.EscreverLinha("", Paleta.Info);
            Paleta.EscreverLinha(" Validando token junto à API do Toggl...", Paleta.Info);
            ClienteApiToggl cliente = new(token);

            if (await cliente.ValidarTokenAsync())
            {
                Paleta.EscreverLinha(" Token válido!", Paleta.Sucesso);
                return token;
            }

            Paleta.EscreverLinha(" Não foi possível validar o token (verifique o valor e a conexão).", Paleta.Erro);

            if (Prompt.Confirmar(" Tentar digitar novamente?", padraoSim: true))
                continue;

            return Prompt.Confirmar(" Salvar assim mesmo, sem validação?") ? token : null;
        }
    }

    private static void Pausar()
    {
        Paleta.Escrever("\n [Enter] para continuar...", Paleta.Neutro);
        Console.ReadLine();
    }
}