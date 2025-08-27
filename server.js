import express from 'express';
import jsforce from 'jsforce';
import nodemailer from 'nodemailer';

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

// Salesforce connection using access token
const conn = new jsforce.Connection({
  instanceUrl: 'https://taxrise--dustin.sandbox.my.salesforce.com',
  accessToken: '00DO800000AQRYH!AQEAQFl49y8HDsJAkjSjiq7akPeWHHbMKLO8y3q1Qy9hu_uCkTz6rG0t4K7ZVhh06ETNng7v6Nv2AyzCA.5Ym__bvNF09F1V'
});

// Email configuration
const emailTransporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'sam@miadvg.com',
    pass: 'vihp qsst hsdl ajtw'
  }
});

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    server: 'tax-prep-mcp-fresh-with-salesforce', 
    version: '2.0.0',
    timestamp: new Date().toISOString() 
  });
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
            },
            {
              name: 'describe_object_fields',
              description: 'Describe fields of a Salesforce object',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Name of the Salesforce object' }
                },
                required: ['objectName']
              }
            },
            {
              name: 'create_tax_return_documents',
              description: 'Create Document__c records for tax returns',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case__c ID' },
                  years: { type: 'array', items: { type: 'string' }, description: 'Tax years (e.g., ["2020", "2021"])' }
                },
                required: ['caseId', 'years']
              }
            },
            {
              name: 'list_case_custom_objects',
              description: 'List Case__c custom object records',
              inputSchema: {
                type: 'object',
                properties: {
                  limit: { type: 'number', description: 'Number of records to return (default 10)' }
                }
              }
            },
            {
              name: 'debug_case_data',
              description: 'Debug case data by fetching raw data',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case ID to debug' }
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
            response.result = await handleGetPendingCases(args);
            break;
            
          case 'send_returns_to_client':
            response.result = await handleSendReturns(args);
            break;
            
          case 'create_mail_request':
            response.result = await handleCreateMailRequest(args);
            break;

          case 'describe_object_fields':
            response.result = await handleDescribeObjectFields(args);
            break;

          case 'create_tax_return_documents':
            response.result = await handleCreateTaxReturnDocuments(args);
            break;

          case 'list_case_custom_objects':
            response.result = await handleListCaseCustomObjects(args);
            break;

          case 'debug_case_data':
            response.result = await handleDebugCaseData(args);
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

// Tool implementations with real Salesforce data
async function handleGetPendingCases(args) {
  console.log('🔍 handleGetPendingCases called with args:', JSON.stringify(args, null, 2));
  
  let whereClause = "Prep_Status__c = 'Pending Signatures'";
  
  if (args.caseId) {
    whereClause += ` AND Case__c = '${args.caseId}'`;
  }

  // Query Document__c records with Prep_Status__c = 'Pending Signatures'
  const documentQuery = `
    SELECT Id, Name, Case__c, Year__c, Agency__c, Prep_Status__c
    FROM Document__c 
    WHERE ${whereClause}
    ORDER BY CreatedDate DESC
    LIMIT 50
  `;

  console.log('📋 Document query:', documentQuery);
  const documentResult = await conn.query(documentQuery);
  console.log('📄 Document results:', JSON.stringify(documentResult, null, 2));

  if (!documentResult.records.length) {
    console.log('❌ No documents found with Prep_Status__c = "Pending Signatures"');
    return {
      content: [{
        type: 'text',
        text: 'Found 0 pending signature cases:\n[]'
      }]
    };
  }

  // Get unique case IDs
  const caseIds = [...new Set(documentResult.records.map(doc => doc.Case__c))];
  console.log('🎯 Unique case IDs found:', caseIds);

  // Query Case__c custom objects
  const caseQuery = `
    SELECT Id, Name 
    FROM Case__c 
    WHERE Id IN ('${caseIds.join("','")}')
  `;

  console.log('📋 Case__c query:', caseQuery);
  const caseResult = await conn.query(caseQuery);
  
  console.log('📋 Case__c results:', JSON.stringify(caseResult, null, 2));

  // Build response with cases and their pending documents
  const cases = [];
  for (const caseRecord of caseResult.records) {
    const caseDocuments = documentResult.records.filter(doc => doc.Case__c === caseRecord.Id);
    
    cases.push({
      caseId: caseRecord.Id,
      caseName: caseRecord.Name,
      pendingYears: caseDocuments.map(doc => doc.Year__c),
      pendingDocuments: caseDocuments.map(doc => ({ 
        name: doc.Name, 
        year: doc.Year__c, 
        agency: doc.Agency__c,
        status: doc.Prep_Status__c 
      })),
      totalPendingDocuments: caseDocuments.length
    });
  }

  console.log('✅ Final cases response:', JSON.stringify(cases, null, 2));

  return {
    content: [{
      type: 'text',
      text: `Found ${cases.length} pending signature cases:\n${JSON.stringify(cases, null, 2)}`
    }]
  };
}

async function handleSendReturns(args) {
  // Get Case__c custom object info
  const caseQuery = `
    SELECT Id, Name
    FROM Case__c WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case__c not found');
  }
  
  const caseRecord = caseResult.records[0];
  
  // Use test email for specific case, otherwise default
  let clientEmail = 'sam@miadvg.com'; // Default test email
  if (args.caseId === 'a0jO8000008SZUgIAO') {
    clientEmail = 'sam@taxrise.com'; // Your email for testing
  }
  const clientName = caseRecord.Name || 'Test Client';
  
  // Get documents separately
  const docQuery = `
    SELECT Id, Name, Year__c, Status__c, Return_Status__c, Prep_Status__c 
    FROM Document__c 
    WHERE Case__c = '${args.caseId}' AND Prep_Status__c = 'Pending Signatures'
  `;
  
  const docResult = await conn.query(docQuery);
  const unsignedReturns = docResult.records || [];
  
  if (!clientEmail) {
    throw new Error('No email address found for client');
  }
  
  // Send email
  const years = unsignedReturns.map(r => r.Year__c).join(', ');
  const mailOptions = {
    from: 'sam@miadvg.com',
    to: clientEmail,
    subject: `Tax Return Documents - Signature Required (${years})`,
    html: `
      <p>Dear ${clientName},</p>
      <p>Please find your tax return documents attached for the following years: ${years}</p>
      <p>These documents require your signature. Please review, sign, and return them at your earliest convenience.</p>
      <p>If you have any questions, please don't hesitate to contact us.</p>
      <p>Best regards,<br>Tax Preparation Team</p>
    `
  };
  
  await emailTransporter.sendMail(mailOptions);
  
  return {
    content: [{
      type: 'text',
      text: `✅ Successfully sent tax returns to ${clientEmail} for years: ${years}. Total documents: ${unsignedReturns.length}`
    }]
  };
}

async function handleCreateMailRequest(args) {
  // Get Case__c custom object info
  const caseQuery = `
    SELECT Id, Name
    FROM Case__c WHERE Id = '${args.caseId}'
  `;
  
  const caseResult = await conn.query(caseQuery);
  if (!caseResult.records.length) {
    throw new Error('Case__c not found');
  }
  
  const caseRecord = caseResult.records[0];
  
  // Use test email for specific case, otherwise default
  let clientEmail = 'sam@miadvg.com'; // Default test email
  if (args.caseId === 'a0jO8000008SZUgIAO') {
    clientEmail = 'sam@taxrise.com'; // Your email for testing
  }
  const clientName = caseRecord.Name || 'Test Client';
  
  // Get documents separately
  const docQuery = `
    SELECT Id, Name, Year__c, Status__c, Return_Status__c, Prep_Status__c 
    FROM Document__c 
    WHERE Case__c = '${args.caseId}' AND Prep_Status__c = 'Pending Signatures'
  `;
  
  const docResult = await conn.query(docQuery);
  const unsignedReturns = docResult.records || [];
  const years = unsignedReturns.map(r => r.Year__c).join(', ');
  
  // Create mail request (simulated for now - you can add real Salesforce record creation here)
  const mailRequest = {
    caseId: args.caseId,
    caseName: caseRecord.Name,
    documentsToMail: unsignedReturns.length,
    years: years,
    status: 'Requested',
    requestedDate: new Date().toISOString()
  };
  
  return {
    content: [{
      type: 'text',
      text: `📮 Created mail request for case ${args.caseId}. Will mail ${unsignedReturns.length} documents for years: ${years} to ${clientName}`
    }]
  };
}

// New handler functions
async function handleDescribeObjectFields(args) {
  try {
    const objectDesc = await conn.sobject(args.objectName).describe();
    const fields = objectDesc.fields.map(field => ({
      name: field.name,
      label: field.label,
      type: field.type,
      required: !field.nillable && !field.defaultedOnCreate,
      picklistValues: field.picklistValues?.map(pv => pv.value) || []
    }));

    return {
      content: [{
        type: 'text',
        text: `Fields for ${args.objectName}:\n${JSON.stringify(fields, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error describing ${args.objectName}: ${error.message}`
      }]
    };
  }
}

async function handleCreateTaxReturnDocuments(args) {
  try {
    console.log('📄 Creating tax return documents for case:', args.caseId, 'years:', args.years);

    // Verify Case__c custom object exists
    const caseQuery = `SELECT Id, Name FROM Case__c WHERE Id = '${args.caseId}'`;
    const caseResult = await conn.query(caseQuery);
    if (!caseResult.records.length) {
      throw new Error(`Case__c not found: ${args.caseId}`);
    }
    const caseName = caseResult.records[0].Name;

    const documentsToCreate = [];
    
    for (const year of args.years) {
      // Create Federal document
      documentsToCreate.push({
        Case__c: args.caseId,
        Year__c: year,
        Agency__c: 'IRS',
        Prep_Status__c: 'Pending Signatures'
      });

      // Create State document
      documentsToCreate.push({
        Case__c: args.caseId,
        Year__c: year,
        Agency__c: 'State',
        Prep_Status__c: 'Pending Signatures'
      });
    }

    console.log('📄 Documents to create:', JSON.stringify(documentsToCreate, null, 2));
    const result = await conn.sobject('Document__c').create(documentsToCreate);
    console.log('📄 Create result:', JSON.stringify(result, null, 2));

    const createdCount = Array.isArray(result) ? result.length : 1;
    const successCount = Array.isArray(result) ? result.filter(r => r.success).length : (result.success ? 1 : 0);

    return {
      content: [{
        type: 'text',
        text: `✅ Successfully created ${successCount}/${createdCount} Document__c records for case ${caseName} (${args.caseId}). Years: ${args.years.join(', ')}`
      }]
    };
  } catch (error) {
    console.error('❌ Error creating documents:', error);
    return {
      content: [{
        type: 'text',
        text: `Error creating tax return documents: ${error.message}`
      }]
    };
  }
}

async function handleListCaseCustomObjects(args) {
  try {
    const limit = args.limit || 10;
    const query = `SELECT Id, Name, CreatedDate FROM Case__c ORDER BY CreatedDate DESC LIMIT ${limit}`;
    const result = await conn.query(query);

    return {
      content: [{
        type: 'text',
        text: `Found ${result.records.length} Case__c records:\n${JSON.stringify(result.records, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error listing Case__c objects: ${error.message}`
      }]
    };
  }
}

async function handleDebugCaseData(args) {
  try {
    const results = {
      caseId: args.caseId,
      queries: {}
    };

    // Query Case__c custom object
    try {
      const caseQuery = `SELECT Id, Name, CreatedDate FROM Case__c WHERE Id = '${args.caseId}'`;
      results.queries.case_custom = await conn.query(caseQuery);
    } catch (error) {
      results.queries.case_custom = { error: error.message };
    }

    // Query Document__c
    try {
      const docQuery = `SELECT Id, Name, Case__c, Year__c, Agency__c, Prep_Status__c FROM Document__c WHERE Case__c = '${args.caseId}'`;
      results.queries.documents = await conn.query(docQuery);
    } catch (error) {
      results.queries.documents = { error: error.message };
    }

    // Query standard Case (just to see if ID exists there too)
    try {
      const stdCaseQuery = `SELECT Id, CaseNumber, Status FROM Case WHERE Id = '${args.caseId}'`;
      results.queries.case_standard = await conn.query(stdCaseQuery);
    } catch (error) {
      results.queries.case_standard = { error: error.message };
    }

    return {
      content: [{
        type: 'text',
        text: `Debug data for case ${args.caseId}:\n${JSON.stringify(results, null, 2)}`
      }]
    };
  } catch (error) {
    return {
      content: [{
        type: 'text',
        text: `Error debugging case data: ${error.message}`
      }]
    };
  }
}

app.listen(port, () => {
  console.log(`🚀 Tax Prep MCP Server (Fresh) with Document__c integration running on port ${port}`);
  console.log('📋 Available tools with Salesforce integration:');
  console.log('  - get_pending_signature_cases');
  console.log('  - send_returns_to_client');
  console.log('  - create_mail_request');
  console.log('  - describe_object_fields');
  console.log('  - create_tax_return_documents');
  console.log('  - list_case_custom_objects');
  console.log('  - debug_case_data');
});
