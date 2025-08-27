import express from 'express';

const app = express();
const port = process.env.PORT || 3002;

app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') return res.sendStatus(200);
  next();
});

// Logging
app.use((req, res, next) => {
  console.log(`${req.method} ${req.path} - ${JSON.stringify(req.body)}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', server: 'tax-prep-mcp-fresh', timestamp: new Date().toISOString() });
});

// MCP endpoint handler
app.post('/', async (req, res) => {
  const { method, id, params } = req.body;
  
  const response = {
    jsonrpc: '2.0',
    id: id || 0
  };

  try {
    switch (method) {
      case 'initialize':
        response.result = {
          protocolVersion: '2025-06-18',
          capabilities: { tools: {} },
          serverInfo: { name: 'tax-prep-mcp-fresh', version: '1.0.0' }
        };
        break;
        
      case 'tools/list':
        response.result = {
          tools: [
            {
              name: 'get_pending_signature_cases',
              description: 'Get tax return cases that are pending client signatures',
              inputSchema: {
                type: 'object',
                properties: {
                  clientName: { type: 'string', description: 'Client name for filtering (optional)' },
                  phoneNumber: { type: 'string', description: 'Client phone number for filtering (optional)' },
                  caseId: { type: 'string', description: 'Specific case ID to look up (optional)' }
                }
              }
            },
            {
              name: 'send_returns_to_client',
              description: 'Email tax return documents to client',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to send returns for' }
                },
                required: ['caseId']
              }
            },
            {
              name: 'create_mail_request',
              description: 'Create a mail request to physically mail tax documents to client',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to create mail request for' }
                },
                required: ['caseId']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          case 'get_pending_signature_cases':
            response.result = {
              content: [{
                type: 'text',
                text: `Found 2 pending signature cases. Case ID: a0jO8000005Oi1qIAC, Client: ${args.clientName || 'John Doe'}, Pending years: 2022, 2023. Email: john.doe@example.com, Phone: ${args.phoneNumber || '(555) 123-4567'}`
              }]
            };
            break;
            
          case 'send_returns_to_client':
            response.result = {
              content: [{
                type: 'text',
                text: `✅ Successfully sent tax returns to client for case ${args.caseId}. Email sent to client with documents for years: 2022, 2023. Total documents: 2`
              }]
            };
            break;
            
          case 'create_mail_request':
            response.result = {
              content: [{
                type: 'text',
                text: `📮 Created mail request for case ${args.caseId}. Will mail 2 documents for years: 2022, 2023 to client's address. Mail request ID: MR-${Date.now()}`
              }]
            };
            break;
            
          default:
            response.error = { code: -32601, message: `Unknown tool: ${name}` };
        }
        break;
        
      default:
        response.error = { code: -32601, message: `Unknown method: ${method}` };
    }
  } catch (error) {
    console.error('MCP Error:', error);
    response.error = { code: -32603, message: error.message };
  }
  
  res.json(response);
});

app.listen(port, () => {
  console.log(`🚀 Tax Prep MCP Server (Fresh) running on port ${port}`);
  console.log('📋 Available tools:');
  console.log('  - get_pending_signature_cases');
  console.log('  - send_returns_to_client');
  console.log('  - create_mail_request');
});
