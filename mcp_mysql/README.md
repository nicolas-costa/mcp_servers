# MySQL Control Bridge

Servidor MCP (Model Context Protocol) para integração com MySQL, permitindo que IAs executem consultas seguras e obtenham informações detalhadas sobre bancos de dados MySQL através de ferramentas estruturadas.

## Funcionalidades

### Consultas e Análise
- **Consultas SELECT seguras** - Execute apenas consultas de leitura
- **Análise de queries** - Explique planos de execução com EXPLAIN

### Explorar Banco de Dados
- **Listagem de bancos** - Visualize todos os bancos de dados disponíveis
- **Listagem de tabelas** - Visualize todas as tabelas e views do banco
- **Descrever tabelas** - Obtenha estrutura detalhada das tabelas (colunas, tipos, chaves, etc.)
- **Descrever views** - Veja a definição e estrutura de views
- **Descrever índices** - Liste todos os índices de uma tabela
- **Descrever triggers** - Liste todos os triggers de uma tabela ou banco
- **Descrever procedures** - Liste todas as stored procedures e funções

### Segurança
- **Somente SELECTs** - Apenas consultas de leitura são permitidas
- **Limite de resultados** - Máximo de 1000 registros por consulta
- **Validação de queries** - Verificação automática de comandos perigosos
- **Conexão segura** - Sem multiple statements habilitados

## Instalação

### Usando npx (recomendado)

O pacote pode ser usado diretamente via `npx` sem necessidade de instalação global:

```bash
npx mysql_control_bridge
```

### Instalação Local (opcional)

```bash
npm install mysql_control_bridge
```

### Variáveis de Ambiente Obrigatórias

```bash
MYSQL_HOST=localhost
MYSQL_USER=seu_usuario
MYSQL_DATABASE=sua_base_dados
```

### Variáveis de Ambiente Opcionais

```bash
MYSQL_PORT=3306              # Padrão: 3306
MYSQL_PASSWORD=sua_senha     # Padrão: string vazia
```

## Configuração no Cursor IDE

Crie o arquivo `.cursor/mcp.json` na raiz do seu workspace com o conteúdo abaixo:

```json
{
  "mcpServers": {
    "mysql": {
      "command": "npx",
      "args": [
        "-y",
        "mysql_control_bridge"
      ],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_PORT": "3306",
        "MYSQL_USER": "seu_usuario",
        "MYSQL_PASSWORD": "sua_senha",
        "MYSQL_DATABASE": "sua_base_dados"
      }
    }
  }
}
```

### Por que usar `.cursor/mcp.json`?

- ✅ **Versionável**: Pode ser commitado e compartilhado com a equipe via Git
- ✅ **Isolado por projeto**: Não afeta outras pastas ou instalações do Cursor
- ✅ **Fácil trocar de ambiente**: Crie múltiplas entradas como `mysql-dev`, `mysql-hml` e `mysql-prod`
- ✅ **Sem instalação global**: Use `npx` para executar diretamente do npm registry
- ✅ **Flexível**: A configuração vive junto do projeto e pode variar por workspace

### Exemplo com Múltiplos Ambientes

```json
{
  "mcpServers": {
    "mysql-dev": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "localhost",
        "MYSQL_USER": "dev_user",
        "MYSQL_PASSWORD": "dev_pass",
        "MYSQL_DATABASE": "development_db"
      }
    },
    "mysql-prod": {
      "command": "npx",
      "args": ["-y", "mysql_control_bridge"],
      "env": {
        "MYSQL_HOST": "prod.example.com",
        "MYSQL_USER": "prod_user",
        "MYSQL_PASSWORD": "prod_pass",
        "MYSQL_DATABASE": "production_db"
      }
    }
  }
}
```

## Ferramentas Disponíveis

### 1. execute_select_query
Executa queries SELECT com segurança.

**Parâmetros:**
- `query` (string, obrigatório): Query SELECT para executar
- `limit` (number, opcional): Limite de resultados (máximo 1000, padrão 100)

**Exemplo:**
```sql
SELECT * FROM usuarios WHERE ativo = 1
```

### 2. describe_table
Mostra a estrutura detalhada de uma tabela (colunas, tipos, chaves, engine, etc.).

**Parâmetros:**
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
usuarios
```

### 3. describe_view
Mostra a definição e estrutura de uma view.

**Parâmetros:**
- `viewName` (string, obrigatório): Nome da view

**Exemplo:**
```
v_relatorio_vendas
```

### 4. describe_indexes
Lista todos os índices de uma tabela.

**Parâmetros:**
- `tableName` (string, obrigatório): Nome da tabela

**Exemplo:**
```
pedidos
```

### 5. describe_triggers
Lista todos os triggers de uma tabela específica ou de todo o banco.

**Parâmetros:**
- `tableName` (string, opcional): Nome da tabela (deixe vazio para listar todos)

**Exemplo:**
```
usuarios
```
ou deixe vazio para listar todos os triggers do banco.

### 6. describe_procedures
Lista todas as stored procedures e funções do banco de dados.

**Sem parâmetros**

### 7. explain_query
Analisa o plano de execução de uma query.

**Parâmetros:**
- `query` (string, obrigatório): Query para analisar

**Exemplo:**
```sql
SELECT * FROM pedidos p JOIN usuarios u ON p.usuario_id = u.id WHERE u.cidade = 'São Paulo'
```

### 8. show_tables
Lista todas as tabelas e views do banco de dados atual.

**Sem parâmetros**

### 9. show_databases
Lista todos os bancos de dados disponíveis no servidor MySQL.

**Sem parâmetros**

## Exemplos de Uso no Cursor

Após configurar o servidor, você pode usar comandos como:

```
"Liste todos os bancos de dados disponíveis"
"Mostre todas as tabelas do banco atual"
"Descreva a estrutura da tabela usuarios"
"Descreva a view v_relatorio_vendas"
"Mostre os índices da tabela pedidos"
"Liste todos os triggers da tabela usuarios"
"Mostre todas as stored procedures"
"Execute: SELECT COUNT(*) FROM pedidos WHERE data_pedido >= '2024-01-01'"
"Explique esta query: SELECT * FROM produtos WHERE preco > 100"
```

## Segurança

- **Somente SELECTs**: Apenas consultas de leitura são permitidas
- **Limite de resultados**: Máximo de 1000 registros por consulta
- **Validação de queries**: Verificação automática de comandos perigosos
- **Conexão segura**: Sem multiple statements habilitados
- **Sem acesso a dados sensíveis**: Não permite DROP, DELETE, UPDATE, INSERT, etc.

## Solução de Problemas

### Erro de Conexão
```
❌ Erro ao conectar ao MySQL: connect ECONNREFUSED
```
**Solução:** Verifique se o MySQL está rodando e as credenciais estão corretas.

### Variáveis de Ambiente Faltando
```
❌ Variáveis de ambiente faltando: MYSQL_HOST, MYSQL_USER
```
**Solução:** Configure todas as variáveis obrigatórias no `.cursor/mcp.json`.

### Permissões Insuficientes
```
❌ Access denied for user
```
**Solução:** Verifique as permissões do usuário MySQL. O usuário precisa de permissão de SELECT no banco de dados e acesso a `information_schema`.

### View não encontrada
```
❌ View 'nome_view' não encontrada no banco 'database'
```
**Solução:** Verifique se o nome da view está correto e se ela existe no banco de dados atual.

## Requisitos

- Node.js >= 14
- MySQL >= 5.7 ou MariaDB >= 10.2
- Cursor IDE com suporte a MCP

## Versão

1.1.0

## Licença

ISC License

## Contribuição

1. Fork o projeto
2. Crie uma branch para sua feature
3. Commit suas mudanças
4. Push para a branch
5. Abra um Pull Request
