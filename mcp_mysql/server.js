#!/usr/bin/env node

const { Server } = require('@modelcontextprotocol/sdk/server/index.js');
const { StdioServerTransport } = require('@modelcontextprotocol/sdk/server/stdio.js');
const {
  ListToolsRequestSchema,
  CallToolRequestSchema
} = require('@modelcontextprotocol/sdk/types.js');
const mysql = require('mysql2/promise');
const path = require('path');
const fs = require('fs');
const dotenv = require('dotenv');

// Tentar carregar arquivo .env da raiz do projeto
// Procura em diretórios pais até encontrar um .env ou chegar na raiz do sistema
function loadEnvFile() {
  let currentDir = process.cwd();
  const rootPath = path.parse(currentDir).root;
  
  // Tentar encontrar .env subindo pelos diretórios pais
  while (currentDir !== rootPath) {
    const envPath = path.join(currentDir, '.env');
    if (fs.existsSync(envPath)) {
      const result = dotenv.config({ path: envPath });
      if (!result.error) {
        console.error(`✅ Arquivo .env carregado: ${envPath}`);
        return true;
      }
    }
    currentDir = path.dirname(currentDir);
  }
  
  // Se não encontrou, tentar no diretório atual
  const envPath = path.join(process.cwd(), '.env');
  if (fs.existsSync(envPath)) {
    const result = dotenv.config({ path: envPath });
    if (!result.error) {
      console.error(`✅ Arquivo .env carregado: ${envPath}`);
      return true;
    }
  }
  
  return false;
}

// Carregar .env se existir (opcional - não gera erro se não encontrar)
loadEnvFile();

class MySQLControlBridge {
  constructor() {
    this.server = new Server(
      {
        name: 'mysql-control-bridge',
        version: '1.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.connection = null;
    this.setupHandlers();
  }

  async connect() {
    try {
      // Validar ENVs obrigatórias
      const requiredEnvs = ['MYSQL_HOST', 'MYSQL_USER', 'MYSQL_DATABASE'];
      const missing = requiredEnvs.filter(env => !process.env[env]);

      if (missing.length > 0) {
        throw new Error(`Variáveis de ambiente faltando: ${missing.join(', ')}`);
      }

      this.connection = await mysql.createConnection({
        host: process.env.MYSQL_HOST,
        port: parseInt(process.env.MYSQL_PORT || '3306'),
        user: process.env.MYSQL_USER,
        password: process.env.MYSQL_PASSWORD || '',
        database: process.env.MYSQL_DATABASE,
        multipleStatements: false // Segurança - prevenir SQL injection
      });

      // Testar conexão
      await this.connection.ping();
      console.error(`✅ Conectado ao MySQL: ${process.env.MYSQL_DATABASE}@${process.env.MYSQL_HOST}`);
    } catch (error) {
      console.error('❌ Erro ao conectar ao MySQL:', error.message);
      console.error('📋 ENVs disponíveis:', {
        MYSQL_HOST: process.env.MYSQL_HOST,
        MYSQL_PORT: process.env.MYSQL_PORT,
        MYSQL_USER: process.env.MYSQL_USER,
        MYSQL_DATABASE: process.env.MYSQL_DATABASE,
        // Não logar a senha por segurança
        MYSQL_PASSWORD: process.env.MYSQL_PASSWORD ? '***' : 'não definida'
      });
      throw error;
    }
  }

  setupHandlers() {
    // Listar ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'execute_select_query',
            title: 'Executar Query SELECT',
            description: 'Executa uma query SELECT (somente leitura)',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query SELECT para executar',
                },
                limit: {
                  type: 'number',
                  description: 'Limite de resultados (máximo 1000)',
                  default: 100,
                  maximum: 1000
                }
              },
              required: ['query'],
            },
          },
          {
            name: 'describe_table',
            title: 'Descrever Tabela',
            description: 'Mostra informações detalhadas sobre uma tabela (colunas, tipos, chaves, etc.)',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'describe_view',
            title: 'Descrever View',
            description: 'Mostra a definição e estrutura de uma view',
            inputSchema: {
              type: 'object',
              properties: {
                viewName: {
                  type: 'string',
                  description: 'Nome da view',
                },
              },
              required: ['viewName'],
            },
          },
          {
            name: 'describe_indexes',
            title: 'Descrever Índices',
            description: 'Lista todos os índices de uma tabela',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela',
                },
              },
              required: ['tableName'],
            },
          },
          {
            name: 'describe_triggers',
            title: 'Descrever Triggers',
            description: 'Lista todos os triggers de uma tabela',
            inputSchema: {
              type: 'object',
              properties: {
                tableName: {
                  type: 'string',
                  description: 'Nome da tabela (opcional, vazio para listar todos)',
                },
              },
            },
          },
          {
            name: 'describe_procedures',
            title: 'Descrever Procedures',
            description: 'Lista todas as stored procedures do banco de dados',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'explain_query',
            title: 'Explicar Query',
            description: 'Explica o plano de execução de uma query',
            inputSchema: {
              type: 'object',
              properties: {
                query: {
                  type: 'string',
                  description: 'Query para analisar',
                },
              },
              required: ['query'],
            },
          },
          {
            name: 'show_tables',
            title: 'Mostrar Tabelas',
            description: 'Lista todas as tabelas do banco de dados atual',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          },
          {
            name: 'show_databases',
            title: 'Mostrar Bancos de Dados',
            description: 'Lista todos os bancos de dados disponíveis no servidor',
            inputSchema: {
              type: 'object',
              properties: {},
            },
          }
        ],
      };
    });

    // Executar ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      if (!this.connection) await this.connect();

      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'execute_select_query':
            return await this.executeSelectQuery(args);

          case 'describe_table':
            return await this.describeTable(args.tableName);

          case 'describe_view':
            return await this.describeView(args.viewName);

          case 'describe_indexes':
            return await this.describeIndexes(args.tableName);

          case 'describe_triggers':
            return await this.describeTriggers(args.tableName);

          case 'describe_procedures':
            return await this.describeProcedures();

          case 'explain_query':
            return await this.explainQuery(args.query);

          case 'show_tables':
            return await this.showTables();

          case 'show_databases':
            return await this.showDatabases();

          default:
            throw new Error(`Ferramenta desconhecida: ${name}`);
        }
      } catch (error) {
        return {
          content: [{
            type: 'text',
            text: `❌ **Erro:** ${error.message}`,
          }],
          isError: true,
        };
      }
    });
  }

  async executeSelectQuery(args) {
    // Validar que é SELECT
    const query = args.query.trim();
    if (!query.toLowerCase().startsWith('select')) {
      throw new Error('Apenas queries SELECT são permitidas');
    }

    const limit = Math.min(args.limit || 100, 1000);
    const finalQuery = query.toLowerCase().includes('limit')
      ? query
      : `${query} LIMIT ${limit}`;

    const [results] = await this.connection.execute(finalQuery);

    return {
      content: [{
        type: 'text',
        text: `✅ Query executada com sucesso!\n\n📊 **Resultados (${results.length} linhas):**\n\n\`\`\`json\n${JSON.stringify(results, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeTable(tableName) {
    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    const [desc] = await this.connection.execute(`
      SELECT
        COLUMN_NAME as Campo,
        COLUMN_TYPE as Tipo,
        IS_NULLABLE as Nulo,
        COLUMN_KEY as Chave,
        COLUMN_DEFAULT as Padrão,
        EXTRA as Extra,
        COLUMN_COMMENT as Comentário
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [process.env.MYSQL_DATABASE, tableName]);

    if (desc.length === 0) {
      throw new Error(`Tabela '${tableName}' não encontrada no banco '${process.env.MYSQL_DATABASE}'`);
    }

    // Buscar informações adicionais sobre a tabela
    const [tableInfo] = await this.connection.execute(`
      SELECT
        TABLE_TYPE as Tipo,
        ENGINE as Engine,
        TABLE_ROWS as Linhas,
        TABLE_COLLATION as Collation,
        TABLE_COMMENT as Comentário
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.MYSQL_DATABASE, tableName]);

    return {
      content: [{
        type: 'text',
        text: `📋 **Estrutura da tabela \`${tableName}\`:**\n\n` +
          `**Informações Gerais:**\n\`\`\`json\n${JSON.stringify(tableInfo[0], null, 2)}\n\`\`\`\n\n` +
          `**Colunas:**\n\`\`\`json\n${JSON.stringify(desc, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeView(viewName) {
    if (!viewName) {
      throw new Error('Nome da view é obrigatório');
    }

    // Buscar definição da view
    const [viewDef] = await this.connection.execute(`
      SELECT
        TABLE_NAME as Nome,
        VIEW_DEFINITION as Definição,
        CHECK_OPTION as CheckOption,
        IS_UPDATABLE as Atualizável,
        DEFINER as Definidor,
        SECURITY_TYPE as TipoSegurança
      FROM information_schema.VIEWS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
    `, [process.env.MYSQL_DATABASE, viewName]);

    if (viewDef.length === 0) {
      throw new Error(`View '${viewName}' não encontrada no banco '${process.env.MYSQL_DATABASE}'`);
    }

    // Buscar estrutura das colunas da view
    const [columns] = await this.connection.execute(`
      SELECT
        COLUMN_NAME as Campo,
        DATA_TYPE as TipoDados,
        IS_NULLABLE as Nulo,
        COLUMN_DEFAULT as Padrão,
        COLUMN_COMMENT as Comentário
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION
    `, [process.env.MYSQL_DATABASE, viewName]);

    return {
      content: [{
        type: 'text',
        text: `👁️ **Informações da view \`${viewName}\`:**\n\n` +
          `**Definição:**\n\`\`\`json\n${JSON.stringify(viewDef[0], null, 2)}\n\`\`\`\n\n` +
          `**Colunas:**\n\`\`\`json\n${JSON.stringify(columns, null, 2)}\n\`\`\`\n\n` +
          `**SQL da View:**\n\`\`\`sql\nCREATE OR REPLACE VIEW \`${viewName}\` AS ${viewDef[0].Definição}\n\`\`\``,
      }],
    };
  }

  async describeIndexes(tableName) {
    if (!tableName) {
      throw new Error('Nome da tabela é obrigatório');
    }

    const [indexes] = await this.connection.execute(`
      SELECT
        INDEX_NAME as NomeIndice,
        COLUMN_NAME as Coluna,
        NON_UNIQUE as NaoUnico,
        SEQ_IN_INDEX as Sequencia,
        COLLATION as Collation,
        CARDINALITY as Cardinalidade,
        INDEX_TYPE as TipoIndice,
        COMMENT as Comentário
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ?
      ORDER BY INDEX_NAME, SEQ_IN_INDEX
    `, [process.env.MYSQL_DATABASE, tableName]);

    if (indexes.length === 0) {
      throw new Error(`Nenhum índice encontrado para a tabela '${tableName}' ou tabela não existe`);
    }

    return {
      content: [{
        type: 'text',
        text: `🔑 **Índices da tabela \`${tableName}\`:**\n\n\`\`\`json\n${JSON.stringify(indexes, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeTriggers(tableName) {
    let query = `
      SELECT
        TRIGGER_NAME as NomeTrigger,
        EVENT_MANIPULATION as Evento,
        EVENT_OBJECT_TABLE as Tabela,
        ACTION_TIMING as Momento,
        ACTION_STATEMENT as Ação,
        ACTION_ORIENTATION as Orientação,
        DEFINER as Definidor,
        CREATED as Criado
      FROM information_schema.TRIGGERS
      WHERE TRIGGER_SCHEMA = ?
    `;
    const params = [process.env.MYSQL_DATABASE];

    if (tableName) {
      query += ' AND EVENT_OBJECT_TABLE = ?';
      params.push(tableName);
    }

    query += ' ORDER BY TRIGGER_NAME';

    const [triggers] = await this.connection.execute(query, params);

    if (triggers.length === 0) {
      const message = tableName 
        ? `Nenhum trigger encontrado para a tabela '${tableName}'`
        : `Nenhum trigger encontrado no banco '${process.env.MYSQL_DATABASE}'`;
      throw new Error(message);
    }

    return {
      content: [{
        type: 'text',
        text: `⚡ **Triggers${tableName ? ` da tabela \`${tableName}\`` : ''}:**\n\n\`\`\`json\n${JSON.stringify(triggers, null, 2)}\n\`\`\``,
      }],
    };
  }

  async describeProcedures() {
    const [procedures] = await this.connection.execute(`
      SELECT
        ROUTINE_NAME as Nome,
        ROUTINE_TYPE as Tipo,
        DEFINER as Definidor,
        CREATED as Criado,
        LAST_ALTERED as UltimaModificacao,
        ROUTINE_COMMENT as Comentario
      FROM information_schema.ROUTINES
      WHERE ROUTINE_SCHEMA = ?
      ORDER BY ROUTINE_NAME
    `, [process.env.MYSQL_DATABASE]);

    if (procedures.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhuma stored procedure ou função encontrada no banco '${process.env.MYSQL_DATABASE}'`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📦 **Stored Procedures e Funções do banco \`${process.env.MYSQL_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(procedures, null, 2)}\n\`\`\``,
      }],
    };
  }

  async explainQuery(query) {
    if (!query || !query.trim()) {
      throw new Error('Query é obrigatória');
    }

    const [explain] = await this.connection.execute(`EXPLAIN ${query}`);

    return {
      content: [{
        type: 'text',
        text: `🔍 **Plano de execução:**\n\n\`\`\`json\n${JSON.stringify(explain, null, 2)}\n\`\`\``,
      }],
    };
  }

  async showTables() {
    const [tables] = await this.connection.execute(`
      SELECT
        TABLE_NAME as Nome,
        TABLE_TYPE as Tipo,
        ENGINE as Engine,
        TABLE_ROWS as Linhas,
        TABLE_COLLATION as Collation,
        TABLE_COMMENT as Comentario
      FROM information_schema.TABLES
      WHERE TABLE_SCHEMA = ?
      ORDER BY TABLE_TYPE, TABLE_NAME
    `, [process.env.MYSQL_DATABASE]);

    if (tables.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhuma tabela encontrada no banco '${process.env.MYSQL_DATABASE}'`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `📋 **Tabelas e Views do banco \`${process.env.MYSQL_DATABASE}\`:**\n\n\`\`\`json\n${JSON.stringify(tables, null, 2)}\n\`\`\``,
      }],
    };
  }

  async showDatabases() {
    const [databases] = await this.connection.execute(`
      SELECT
        SCHEMA_NAME as Nome,
        DEFAULT_CHARACTER_SET_NAME as CharsetPadrao,
        DEFAULT_COLLATION_NAME as CollationPadrao
      FROM information_schema.SCHEMATA
      ORDER BY SCHEMA_NAME
    `);

    if (databases.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `ℹ️ Nenhum banco de dados encontrado`,
        }],
      };
    }

    return {
      content: [{
        type: 'text',
        text: `🗄️ **Bancos de dados disponíveis:**\n\n\`\`\`json\n${JSON.stringify(databases, null, 2)}\n\`\`\``,
      }],
    };
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🚀 MySQL Control Bridge iniciado (v1.1.0)');
  }
}

// Iniciar servidor
const server = new MySQLControlBridge();
server.run().catch((error) => {
  console.error('❌ Erro fatal:', error);
  process.exit(1);
});

// Cleanup
process.on('SIGINT', async () => {
  console.error('🔌 Desconectando...');
  if (server.connection) {
    await server.connection.end();
  }
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.error('🔌 Desconectando...');
  if (server.connection) {
    await server.connection.end();
  }
  process.exit(0);
});
