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
            // === Schema Discovery Tools ===
            {
              name: 'describe_global_objects',
              description: 'List all available Salesforce objects with metadata',
              inputSchema: {
                type: 'object',
                properties: {}
              }
            },
            {
              name: 'describe_object_fields',
              description: 'Get detailed field metadata for a Salesforce object including field types, picklist values, and relationships',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Name of the Salesforce object (e.g., Account, Document__c, Case__c)' }
                },
                required: ['objectName']
              }
            },
            
            // === Data Query & Manipulation Tools ===
            {
              name: 'query_salesforce',
              description: 'Execute SOQL query against Salesforce. Use this to find records, check existing data patterns, etc.',
              inputSchema: {
                type: 'object',
                properties: {
                  soql: { type: 'string', description: 'SOQL query string (e.g., "SELECT Id, Name FROM Account LIMIT 10")' },
                  limit: { type: 'number', description: 'Maximum records to return (default 50, max 200)', default: 50 }
                },
                required: ['soql']
              }
            },
            {
              name: 'create_records',
              description: 'Create one or more records in Salesforce. Use describe_object_fields first to understand required fields and data types.',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Salesforce object name (e.g., Document__c, Account, Case__c)' },
                  records: { 
                    type: 'array', 
                    description: 'Array of record objects to create. Each object should contain field names and values.',
                    items: { type: 'object' }
                  }
                },
                required: ['objectName', 'records']
              }
            },
            {
              name: 'update_records',
              description: 'Update existing records in Salesforce. Include Id field in each record.',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Salesforce object name' },
                  records: { 
                    type: 'array',
                    description: 'Array of record objects to update. Each must include Id field and fields to update.',
                    items: { 
                      type: 'object',
                      properties: {
                        Id: { type: 'string', description: 'Salesforce record ID' }
                      },
                      required: ['Id']
                    }
                  }
                },
                required: ['objectName', 'records']
              }
            },
            
            // === Business Logic Tools ===
            {
              name: 'send_returns_to_client',
              description: 'Email tax return documents to client with TaxRise branding and attachments',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Case__c ID to send returns for' }
                },
                required: ['caseId']
              }
            },
            
            // === Knowledge Base Tools ===
            {
              name: 'get_document_taxonomy',
              description: 'Get document categories and types for proper classification',
              inputSchema: {
                type: 'object',
                properties: {
                  category: { type: 'string', description: 'Optional: filter by category (e.g., "Tax Prep", "Bank Statements")' }
                }
              }
            },
            {
              name: 'map_intent_to_fields',
              description: 'Map user intents to required Salesforce field combinations. Use this to understand what fields to set based on what the user wants to do.',
              inputSchema: {
                type: 'object',
                properties: {
                  intent: { type: 'string', description: 'User intent (e.g., "file tax return", "upload bank statement", "create collection notice")' },
                  objectName: { type: 'string', description: 'Target Salesforce object (e.g., "Document__c")' }
                },
                required: ['intent', 'objectName']
              }
            },
            {
              name: 'discover_data_patterns',
              description: 'Query existing Salesforce data to discover field patterns and business rules. Use this to learn from existing records.',
              inputSchema: {
                type: 'object',
                properties: {
                  objectName: { type: 'string', description: 'Salesforce object to analyze (e.g., "Document__c")' },
                  intent: { type: 'string', description: 'What pattern to discover (e.g., "tax return records", "bank statement records")' },
                  sampleSize: { type: 'number', description: 'Number of records to analyze (default 10)', default: 10 }
                },
                required: ['objectName', 'intent']
              }
            }
          ]
        };
        break;
        
      case 'tools/call':
        const { name, arguments: args } = params;
        
        switch (name) {
          // Schema Discovery Tools
          case 'describe_global_objects':
            response.result = await handleDescribeGlobal(args);
            break;
            
          case 'describe_object_fields':
            response.result = await handleDescribeObject(args);
            break;
          
          // Data Operations
          case 'query_salesforce':
            response.result = await handleQuery(args);
            break;
            
          case 'create_records':
            response.result = await handleCreate(args);
            break;
            
          case 'update_records':
            response.result = await handleUpdate(args);
            break;
          
          // Business Logic Tools  
          case 'send_returns_to_client':
            response.result = await handleSendReturns(args);
            break;
          
          // Knowledge Base Tools
          case 'get_document_taxonomy':
            response.result = await handleDocumentTaxonomy(args);
            break;
            
          case 'map_intent_to_fields':
            response.result = await handleIntentToFields(args);
            break;
            
          case 'discover_data_patterns':
            response.result = await handleDiscoverPatterns(args);
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

// === Schema Discovery Tools ===
async function handleDescribeGlobal(args) {
  try {
    console.log('🌍 Getting global Salesforce object list');
    const globalDesc = await conn.describeGlobal();
    
    // Return curated list with key metadata
    const objects = globalDesc.sobjects
      .filter(obj => obj.queryable && obj.createable) // Only show actionable objects
      .map(obj => ({
        name: obj.name,
        label: obj.label,
        queryable: obj.queryable,
        createable: obj.createable,
        updateable: obj.updateable,
        deletable: obj.deletable,
        custom: obj.custom
      }))
      .sort((a, b) => a.label.localeCompare(b.label));

    return {
      content: [{
        type: 'text', 
        text: `Found ${objects.length} queryable Salesforce objects:\n${JSON.stringify(objects, null, 2)}`
      }]
    };
  } catch (error) {
    console.error('❌ Error describing global:', error);
    return {
      content: [{
        type: 'text',
        text: `Error getting Salesforce objects: ${error.message}`
      }]
    };
  }
}

async function handleDescribeObject(args) {
  try {
    console.log(`🔍 Describing Salesforce object: ${args.objectName}`);
    const objectDesc = await conn.sobject(args.objectName).describe();
    
    // Extract key metadata
    const metadata = {
      name: objectDesc.name,
      label: objectDesc.label, 
      createable: objectDesc.createable,
      updateable: objectDesc.updateable,
      queryable: objectDesc.queryable,
      deletable: objectDesc.deletable,
      fields: objectDesc.fields.map(field => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: !field.nillable && !field.defaultedOnCreate,
        picklistValues: field.picklistValues?.map(pv => pv.value) || [],
        relationshipName: field.relationshipName || null,
        referenceTo: field.referenceTo || []
      })).sort((a, b) => a.label.localeCompare(b.label))
    };

    return {
      content: [{
        type: 'text',
        text: `Schema for ${args.objectName}:\n${JSON.stringify(metadata, null, 2)}`
      }]
    };
  } catch (error) {
    console.error(`❌ Error describing ${args.objectName}:`, error);
    return {
      content: [{
        type: 'text',
        text: `Error describing ${args.objectName}: ${error.message}`
      }]
    };
  }
}

// === Data Operations ===
async function handleQuery(args) {
  try {
    console.log(`📋 Executing SOQL: ${args.soql}`);
    
    // Apply limit safety
    const limit = Math.min(args.limit || 50, 200);
    let soql = args.soql.trim();
    
    // Add LIMIT if not present
    if (!soql.toUpperCase().includes('LIMIT')) {
      soql += ` LIMIT ${limit}`;
    }
    
    const result = await conn.query(soql);
    
    return {
      content: [{
        type: 'text',
        text: `Query returned ${result.records.length} records:\n${JSON.stringify(result.records, null, 2)}`
      }]
    };
  } catch (error) {
    console.error('❌ SOQL Error:', error);
    return {
      content: [{
        type: 'text',
        text: `SOQL Error: ${error.message}`
      }]
    };
  }
}

async function handleCreate(args) {
  try {
    console.log(`➕ Creating ${args.records.length} ${args.objectName} records`);
    console.log('📄 Records to create:', JSON.stringify(args.records, null, 2));
    
    const result = await conn.sobject(args.objectName).create(args.records);
    const results = Array.isArray(result) ? result : [result];
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let responseText = `✅ Created ${successful.length}/${results.length} ${args.objectName} records successfully`;
    
    if (successful.length > 0) {
      responseText += `\n\nSuccessful records:\n${JSON.stringify(successful, null, 2)}`;
    }
    
    if (failed.length > 0) {
      responseText += `\n\n❌ Failed records:\n${JSON.stringify(failed, null, 2)}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: responseText
      }]
    };
  } catch (error) {
    console.error('❌ Create Error:', error);
    return {
      content: [{
        type: 'text',
        text: `Error creating ${args.objectName} records: ${error.message}`
      }]
    };
  }
}

async function handleUpdate(args) {
  try {
    console.log(`✏️ Updating ${args.records.length} ${args.objectName} records`);
    console.log('📄 Records to update:', JSON.stringify(args.records, null, 2));
    
    const result = await conn.sobject(args.objectName).update(args.records);
    const results = Array.isArray(result) ? result : [result];
    
    const successful = results.filter(r => r.success);
    const failed = results.filter(r => !r.success);
    
    let responseText = `✅ Updated ${successful.length}/${results.length} ${args.objectName} records successfully`;
    
    if (failed.length > 0) {
      responseText += `\n\n❌ Failed updates:\n${JSON.stringify(failed, null, 2)}`;
    }
    
    return {
      content: [{
        type: 'text',
        text: responseText
      }]
    };
  } catch (error) {
    console.error('❌ Update Error:', error);
    return {
      content: [{
        type: 'text',
        text: `Error updating ${args.objectName} records: ${error.message}`
      }]
    };
  }
}

// === Knowledge Base Tools ===
async function handleDocumentTaxonomy(args) {
  // Document taxonomy from your JSON file
  const taxonomy = {
    "categories": {
      "Tax Prep": {
        "document_types": [
          "Federal Signed Return", "State Signed Return", "Copy of Tax Returns", 
          "Unsigned", "Signed", "Tax Organizer", "W2", "1099-MISC", "1099-NEC", 
          "1098", "1098-T", "K-1", "Schedule A", "Prior Year Depreciation"
        ]
      },
      "Bank Statements": {
        "document_types": ["Business", "Investment Accounts", "Personal", "Spouse"]
      },
      "Collection Notice": {
        "document_types": ["Collection Notice", "Garnishment Notice", "Levy Notice", "Lien Notice"]
      },
      "Expense Documents": {
        "document_types": [
          "Auto Insurance", "Mortgage Statement", "Rent Statement", "Property Tax",
          "Electric Bill", "Gas Bill", "Water Bill", "Phone Bill", "Internet Bill"
        ]
      }
    }
  };
  
  if (args.category) {
    const category = taxonomy.categories[args.category];
    if (category) {
      return {
        content: [{
          type: 'text',
          text: `Document types for ${args.category}:\n${JSON.stringify(category.document_types, null, 2)}`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text', 
          text: `Category "${args.category}" not found. Available categories: ${Object.keys(taxonomy.categories).join(', ')}`
        }]
      };
    }
  }
  
  return {
    content: [{
      type: 'text',
      text: `Document Taxonomy:\n${JSON.stringify(taxonomy, null, 2)}`
    }]
  };
}

async function handleIntentToFields(args) {
  // Intent-to-field mapping rules for business logic
  const intentMappings = {
    "Document__c": {
      "file tax return": {
        required_fields: {
          "Doc_Category__c": "Tax Prep",
          "Doc_Type__c": "Tax Return"
        },
        conditional_fields: {
          "Agency__c": "IRS or State (based on user request)",
          "Year__c": "Tax year from user input",
          "Prep_Status__c": "Pending (default for new tax returns)"
        },
        business_rule: "Creates records that appear in Tax Prep table for signature workflow"
      },
      "file tax organizer": {
        required_fields: {
          "Doc_Category__c": "Tax Prep", 
          "Doc_Type__c": "Tax Organizer"
        },
        business_rule: "Creates tax organizer documents for data collection"
      },
      "upload bank statement": {
        required_fields: {
          "Doc_Category__c": "Bank Statements",
          "Doc_Type__c": "Personal" // or Business, Investment, Spouse
        },
        business_rule: "Creates bank statement documents for tax preparation"
      },
      "create collection notice": {
        required_fields: {
          "Doc_Category__c": "Collection Notice",
          "Doc_Type__c": "Collection Notice" // or Garnishment, Levy, Lien
        },
        business_rule: "Creates collection-related documents for tax resolution"
      },
      "upload expense document": {
        required_fields: {
          "Doc_Category__c": "Expense Documents"
        },
        conditional_fields: {
          "Doc_Type__c": "Varies (Mortgage Statement, Auto Insurance, etc.)"
        },
        business_rule: "Creates expense documentation for tax deductions"
      }
    }
  };

  const objectMappings = intentMappings[args.objectName];
  if (!objectMappings) {
    return {
      content: [{
        type: 'text',
        text: `No intent mappings found for ${args.objectName}. Available objects: ${Object.keys(intentMappings).join(', ')}`
      }]
    };
  }

  const intentMapping = objectMappings[args.intent.toLowerCase()];
  if (intentMapping) {
    return {
      content: [{
        type: 'text',
        text: `Intent mapping for "${args.intent}" on ${args.objectName}:\n${JSON.stringify(intentMapping, null, 2)}`
      }]
    };
  }

  // Show available intents if not found
  const availableIntents = Object.keys(objectMappings);
  return {
    content: [{
      type: 'text',
      text: `Intent "${args.intent}" not found for ${args.objectName}.\n\nAvailable intents:\n${availableIntents.join(', ')}\n\nAll mappings:\n${JSON.stringify(objectMappings, null, 2)}`
    }]
  };
}

async function handleDiscoverPatterns(args) {
  try {
    console.log(`🔍 Discovering patterns for ${args.intent} in ${args.objectName}`);
    
    // Create query based on intent
    let soql = '';
    const sampleSize = Math.min(args.sampleSize || 10, 20); // Safety limit
    
    if (args.intent.toLowerCase().includes('tax return')) {
      soql = `SELECT Doc_Category__c, Doc_Type__c, Agency__c, Prep_Status__c, Year__c FROM ${args.objectName} WHERE Doc_Category__c = 'Tax Prep' AND Doc_Type__c LIKE '%Return%' ORDER BY CreatedDate DESC LIMIT ${sampleSize}`;
    } else if (args.intent.toLowerCase().includes('bank statement')) {
      soql = `SELECT Doc_Category__c, Doc_Type__c FROM ${args.objectName} WHERE Doc_Category__c = 'Bank Statements' ORDER BY CreatedDate DESC LIMIT ${sampleSize}`;
    } else if (args.intent.toLowerCase().includes('collection')) {
      soql = `SELECT Doc_Category__c, Doc_Type__c FROM ${args.objectName} WHERE Doc_Category__c = 'Collection Notice' ORDER BY CreatedDate DESC LIMIT ${sampleSize}`;
    } else {
      // Generic pattern discovery
      soql = `SELECT Doc_Category__c, Doc_Type__c, Agency__c, Prep_Status__c FROM ${args.objectName} ORDER BY CreatedDate DESC LIMIT ${sampleSize}`;
    }

    console.log(`📋 Pattern discovery query: ${soql}`);
    const result = await conn.query(soql);
    
    if (!result.records.length) {
      return {
        content: [{
          type: 'text',
          text: `No existing records found to analyze patterns for "${args.intent}" in ${args.objectName}`
        }]
      };
    }

    // Analyze patterns
    const patterns = {};
    const fieldCombinations = {};
    
    for (const record of result.records) {
      // Count field value combinations
      const combo = JSON.stringify({
        Doc_Category__c: record.Doc_Category__c,
        Doc_Type__c: record.Doc_Type__c,
        Agency__c: record.Agency__c || null
      });
      
      fieldCombinations[combo] = (fieldCombinations[combo] || 0) + 1;
      
      // Track individual field patterns
      ['Doc_Category__c', 'Doc_Type__c', 'Agency__c', 'Prep_Status__c'].forEach(field => {
        if (record[field]) {
          if (!patterns[field]) patterns[field] = {};
          patterns[field][record[field]] = (patterns[field][record[field]] || 0) + 1;
        }
      });
    }

    // Find most common combination
    const sortedCombos = Object.entries(fieldCombinations)
      .sort(([,a], [,b]) => b - a)
      .map(([combo, count]) => ({ pattern: JSON.parse(combo), frequency: count, percentage: Math.round(count/result.records.length*100) }));

    const analysis = {
      intent: args.intent,
      objectName: args.objectName,
      samplesAnalyzed: result.records.length,
      mostCommonPatterns: sortedCombos.slice(0, 3),
      fieldFrequency: patterns,
      recommendation: sortedCombos[0] ? 
        `For "${args.intent}", most records use: ${JSON.stringify(sortedCombos[0].pattern)}` :
        'No clear pattern found'
    };

    return {
      content: [{
        type: 'text',
        text: `Pattern analysis for "${args.intent}" in ${args.objectName}:\n${JSON.stringify(analysis, null, 2)}`
      }]
    };
    
  } catch (error) {
    console.error('❌ Pattern discovery error:', error);
    return {
      content: [{
        type: 'text',
        text: `Error discovering patterns: ${error.message}`
      }]
    };
  }
}

// === Business Logic Tools (kept from previous) ===
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
      pendingYears: caseDocuments.map(doc => doc.Year__c),  // Keep duplicates - shows IRS + State for same year
      pendingDocuments: caseDocuments.map(doc => ({ 
        name: doc.Name, 
        year: doc.Year__c, 
        agency: doc.Agency__c,
        status: doc.Prep_Status__c  // Keep status - might vary per document
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
  console.log('📧 handleSendReturns called with args:', JSON.stringify(args, null, 2));
  
  // Get documents with full client contact information (mimicking existing Salesforce flow)
  const docQuery = `
    SELECT Id, Name, Year__c, Agency__c, Prep_Status__c,
           Case__r.Client__c, Case__r.Client__r.Name, Case__r.Client__r.PersonEmail, 
           Case__r.Client__r.AlternateEmail__c, Case__r.Client__r.PersonContactId
    FROM Document__c 
    WHERE Case__c = '${args.caseId}' AND Prep_Status__c = 'Pending Signatures'
  `;
  
  console.log('📋 Document query:', docQuery);
  const docResult = await conn.query(docQuery);
  const pendingDocuments = docResult.records || [];
  
  if (!pendingDocuments.length) {
    return {
      content: [{
        type: 'text',
        text: '❌ No documents found with Prep_Status__c = "Pending Signatures" for this case.'
      }]
    };
  }

  // Extract client info from first document (all should have same client)
  const firstDoc = pendingDocuments[0];
  const clientName = firstDoc.Case__r?.Client__r?.Name || 'Client';
  const clientEmail = firstDoc.Case__r?.Client__r?.PersonEmail;
  const alternateEmail = firstDoc.Case__r?.Client__r?.AlternateEmail__c;
  const clientId = firstDoc.Case__r?.Client__c;
  
  console.log('👤 Client Info:', {
    name: clientName,
    email: clientEmail,
    alternateEmail: alternateEmail,
    clientId: clientId
  });

  // Use primary email, fallback to alternate, then test emails
  let recipientEmail = clientEmail || alternateEmail;
  if (!recipientEmail) {
    // Fallback to test emails based on case ID
    recipientEmail = args.caseId === 'a0jO8000008SZUgIAO' ? 'sam@taxrise.com' : 'sam@miadvg.com';
    console.log('⚠️ No client email found, using test email:', recipientEmail);
  }

  // Collect ContentDocument IDs for attachments via separate query
  const contentDocumentIds = new Set();
  const documentsToUpdate = [];
  const documentIds = pendingDocuments.map(doc => doc.Id);
  
  // Query ContentDocumentLinks separately to avoid relationship issues
  if (documentIds.length > 0) {
    try {
      const linkQuery = `
        SELECT Id, ContentDocumentId, LinkedEntityId
        FROM ContentDocumentLink 
        WHERE LinkedEntityId IN ('${documentIds.join("','")}')
      `;
      
      console.log('📎 ContentDocumentLink query:', linkQuery);
      const linkResult = await conn.query(linkQuery);
      
      for (const link of linkResult.records || []) {
        contentDocumentIds.add(link.ContentDocumentId);
      }
      
      console.log(`📎 Found ${linkResult.records?.length || 0} ContentDocumentLinks`);
    } catch (linkError) {
      console.log('⚠️ Error fetching ContentDocumentLinks:', linkError.message);
    }
  }
  
  // Mark documents as sent (mimicking existing flow)  
  for (const doc of pendingDocuments) {
    documentsToUpdate.push({
      Id: doc.Id,
      Is_Doc_Sent_To_Client__c: true
    });
  }

  // Fetch file attachments (mimicking existing ContentVersion query)
  const attachments = [];
  if (contentDocumentIds.size > 0) {
    console.log('📎 Fetching attachments for ContentDocument IDs:', Array.from(contentDocumentIds));
    
    try {
      const contentQuery = `
        SELECT VersionData, FileType, Title, PathOnClient, ContentSize 
        FROM ContentVersion 
        WHERE ContentDocumentId IN ('${Array.from(contentDocumentIds).join("','")}')
        AND IsLatest = true
      `;
      
      const contentResult = await conn.query(contentQuery);
      console.log(`📎 Found ${contentResult.records.length} file attachments`);
      
      for (const file of contentResult.records) {
        if (file.VersionData) {
          attachments.push({
            filename: file.PathOnClient || file.Title,
            content: Buffer.from(file.VersionData, 'base64'),
            contentType: getContentType(file.FileType)
          });
        }
      }
    } catch (error) {
      console.log('⚠️ Error fetching attachments:', error.message);
    }
  }

  // Create TaxRise branded email (mimicking existing template)
  const years = pendingDocuments.map(doc => doc.Year__c).filter(Boolean).join(', ');
  const agencies = [...new Set(pendingDocuments.map(doc => doc.Agency__c).filter(Boolean))].join(', ');
  
  const mailOptions = {
    from: 'TaxRise <sam@miadvg.com>',  // Mimicking setSenderDisplayName('Tax Rise')
    to: recipientEmail,
    subject: `Tax Return Documents - Signature Required (${years})`,  // Mimicking template subject
    html: createTaxRiseEmailTemplate(clientName, years, agencies, pendingDocuments.length),
    attachments: attachments
  };
  
  console.log('📧 Email options:', {
    to: mailOptions.to,
    subject: mailOptions.subject,
    attachmentCount: attachments.length
  });

  try {
    // Send email
    await emailTransporter.sendMail(mailOptions);
    console.log('✅ Email sent successfully');

    // Update documents to mark as sent (mimicking existing update)
    if (documentsToUpdate.length > 0) {
      try {
        await conn.sobject('Document__c').update(documentsToUpdate);
        console.log(`✅ Updated ${documentsToUpdate.length} documents as sent`);
      } catch (updateError) {
        console.log('⚠️ Error updating document status:', updateError.message);
      }
    }

    return {
      content: [{
        type: 'text',
        text: `✅ Successfully sent tax returns to ${recipientEmail} for ${clientName}.\n📄 Documents: ${pendingDocuments.length} (${years})\n📎 Attachments: ${attachments.length} files`
      }]
    };
  } catch (error) {
    console.error('❌ Error sending email:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Error sending email: ${error.message}`
      }]
    };
  }
}

// Helper function to create TaxRise branded email template (mimicking existing template)
function createTaxRiseEmailTemplate(clientName, years, agencies, docCount) {
  return `
    <!DOCTYPE html>
    <html>
    <head>
        <style>
            body { font-family: Arial, sans-serif; color: #333; }
            .header { background-color: #0c68a7; padding: 20px; text-align: center; }
            .header h1 { color: white; margin: 0; font-size: 24px; }
            .content { padding: 30px; background-color: #f9f9f9; }
            .footer { background-color: #45454f; color: white; padding: 15px; text-align: center; }
            .highlight { background-color: #e8f4f8; padding: 15px; border-left: 4px solid #0c68a7; margin: 20px 0; }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>TaxRise</h1>
            <p style="color: white; margin: 5px 0;">We rise by lifting others.</p>
        </div>
        
        <div class="content">
            <p>Hi ${clientName},</p>
            
            <div class="highlight">
                <h3>Tax Return Documents Ready for Signature</h3>
                <p><strong>Years:</strong> ${years}</p>
                <p><strong>Agencies:</strong> ${agencies}</p>
                <p><strong>Total Documents:</strong> ${docCount}</p>
            </div>
            
            <p>Please find your tax return documents attached to this email. These documents require your signature before we can proceed with filing.</p>
            
            <p><strong>Next Steps:</strong></p>
            <ul>
                <li>Review each attached document carefully</li>
                <li>Sign and date where indicated</li>
                <li>Return the signed documents to us as soon as possible</li>
            </ul>
            
            <p>If you have any questions or need assistance, please don't hesitate to contact our Tax Preparation team.</p>
            
            <p>Best regards,<br>
            <strong>TaxRise Tax Preparation Team</strong></p>
        </div>
        
        <div class="footer">
            <p>© 2024 TaxRise. Every client. Every time.</p>
        </div>
    </body>
    </html>
  `;
}

// Helper function to determine content type
function getContentType(fileType) {
  const typeMap = {
    'PDF': 'application/pdf',
    'WORD_X': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'EXCEL_X': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'PNG': 'image/png',
    'JPG': 'image/jpeg',
    'JPEG': 'image/jpeg'
  };
  return typeMap[fileType] || 'application/octet-stream';
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
        Prep_Status__c: 'Pending Signatures',
        Doc_Category__c: 'Tax prep',
        Doc_Type__c: 'tax return'
      });

      // Create State document
      documentsToCreate.push({
        Case__c: args.caseId,
        Year__c: year,
        Agency__c: 'State',
        Prep_Status__c: 'Pending Signatures',
        Doc_Category__c: 'Tax prep',
        Doc_Type__c: 'tax return'
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
  console.log(`🚀 Schema-Aware MCP Server with Dynamic Salesforce Integration running on port ${port}`);
  console.log('📋 Available tools:');
  console.log('  🔍 Schema Discovery:');
  console.log('    - describe_global_objects (list all objects)');
  console.log('    - describe_object_fields (get field metadata)');
  console.log('  📊 Data Operations:');
  console.log('    - query_salesforce (execute SOQL)');
  console.log('    - create_records (create records)');
  console.log('    - update_records (update records)');
  console.log('  💼 Business Logic:');
  console.log('    - send_returns_to_client (email with attachments)');
  console.log('  📚 Knowledge Base:');
  console.log('    - get_document_taxonomy (document categories & types)');
  console.log('    - map_intent_to_fields (map user intents to field requirements)');
  console.log('    - discover_data_patterns (learn from existing data)');
});
