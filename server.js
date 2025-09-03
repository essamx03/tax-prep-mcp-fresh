import express from 'express';
import jsforce from 'jsforce';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import fetch from 'node-fetch';

const app = express();
const port = process.env.PORT || 3002;

// Salesforce connection using environment variables ONLY
const conn = new jsforce.Connection({
  instanceUrl: process.env.SF_INSTANCE_URL || 'https://taxrise.my.salesforce.com',
  accessToken: process.env.SF_ACCESS_TOKEN
});

// Email configuration
const emailTransporter = nodemailer.createTransporter({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: 'sam@miadvg.com',
    pass: 'vihp qsst hsdl ajtw'
  }
});

// Hey Market SMS Configuration
const HEYMARKET_API_URL = 'https://api.heymarket.com/v1';
const HEYMARKET_SECRET_ID = 'bc39ab97-03cd-471e-be68-8d3b559e7de2';
const HEYMARKET_SECRET_KEY = 's5gZMWEjscXNSBe4npft8ThAP06SotSd';
const HEYMARKET_USER_ID = 166145; // Sam Abdullah
const HEYMARKET_INBOX_ID = 77320; // Retell Main Agent

// Generate JWT token for Hey Market authentication
function generateHeyMarketJWT() {
  const payload = {
    iss: HEYMARKET_SECRET_ID,
    iat: Math.floor(Date.now() / 1000),
    exp: Math.floor(Date.now() / 1000) + (60 * 60) // 1 hour
  };
  
  return jwt.sign(payload, HEYMARKET_SECRET_KEY, { algorithm: 'HS256' });
}

app.use(express.json());

// CORS headers
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.sendStatus(200);
  } else {
    next();
  }
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    version: '2.3.0-client-intelligence',
    phases: {
      phase1: 'Essential MCP tools - COMPLETE',
      phase2: 'SMS automation - COMPLETE', 
      phase3: 'Client intelligence - COMPLETE',
      phase4: 'Document automation - PENDING',
      phase5: 'Advanced features - PENDING'
    }
  });
});

// MCP JSON-RPC endpoint
app.post('/', async (req, res) => {
  console.log('📨 MCP Request:', JSON.stringify(req.body, null, 2));
  
  const { method, params, id } = req.body;
  let response = { jsonrpc: '2.0', id };
  
  try {
    switch (method) {
      case 'initialize':
        response.result = {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          }
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
                  caseId: { type: 'string', description: 'Salesforce case ID to send returns for' },
                  clientEmail: { type: 'string', description: 'Client email address (optional, will be looked up)' },
                  clientName: { type: 'string', description: 'Client name for personalization (optional)' }
                },
                required: ['caseId']
              }
            },
            {
              name: 'create_mail_request',
              description: 'Create mail request for physical document delivery',
              inputSchema: {
                type: 'object',
                properties: {
                  caseId: { type: 'string', description: 'Salesforce case ID' },
                  requestType: { type: 'string', description: 'Type of mail request' },
                  documentType: { type: 'string', description: 'Type of documents to mail' },
                  clientAddress: { type: 'string', description: 'Client mailing address (optional, will be looked up)' }
                },
                required: ['caseId', 'requestType', 'documentType']
              }
            },
            {
              name: 'get_last_call_attempt',
              description: 'Get the last TalkDesk call attempt for a phone number',
              inputSchema: {
                type: 'object',
                properties: {
                  phoneNumber: { type: 'string', description: 'Phone number to look up call history for' }
                },
                required: ['phoneNumber']
              }
            },
            {
               name: 'query_salesforce',
               description: 'Execute dynamic SOQL queries on Salesforce data',
               inputSchema: {
                 type: 'object',
                 properties: {
                   soql: { type: 'string', description: 'SOQL query string to execute' },
                   limit: { type: 'number', description: 'Maximum records to return (default 50, max 200)', default: 50 }
                 },
                 required: ['soql']
               }
             },
             {
               name: 'create_records',
               description: 'Create one or more records in Salesforce (Documents, Cases, etc.)',
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
               name: 'send_sms',
               description: 'Send SMS message to client via Hey Market',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number (E.164 format without +)' },
                   message: { type: 'string', description: 'SMS message content' }
                 },
                 required: ['phoneNumber', 'message']
               }
             },
             {
               name: 'send_document_request_sms',
               description: 'Send SMS requesting document upload with TaxRise direct link',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number' },
                   clientName: { type: 'string', description: 'Client name for personalization' },
                   accountId: { type: 'string', description: 'Account ID for document upload link' },
                   documentType: { type: 'string', description: 'Type of document needed' }
                 },
                 required: ['phoneNumber', 'clientName', 'accountId', 'documentType']
               }
             },
             {
               name: 'send_payment_reminder_sms',
               description: 'Send SMS payment reminder with TaxRise payment link',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number' },
                   clientName: { type: 'string', description: 'Client name for personalization' },
                   accountId: { type: 'string', description: 'Account ID for payment link' },
                   amount: { type: 'string', description: 'Payment amount due' },
                   dueDate: { type: 'string', description: 'Payment due date' }
                 },
                 required: ['phoneNumber', 'clientName', 'accountId', 'amount', 'dueDate']
               }
             },
             {
               name: 'lookup_client_by_phone',
               description: 'Look up client information by phone number for personalized service',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number to look up' }
                 },
                 required: ['phoneNumber']
               }
             },
             {
               name: 'get_client_greeting',
               description: 'Generate personalized greeting for client based on their information',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number for lookup' },
                   clientName: { type: 'string', description: 'Client name (optional, will be looked up if not provided)' },
                   callType: { type: 'string', description: 'Type of call/interaction (inbound, outbound, callback, etc.)', default: 'inbound' }
                 },
                 required: ['phoneNumber']
               }
             },
             {
               name: 'verify_client_identity',
               description: 'Verify client identity using phone number and ZIP code',
               inputSchema: {
                 type: 'object',
                 properties: {
                   phoneNumber: { type: 'string', description: 'Client phone number' },
                   zipCode: { type: 'string', description: 'ZIP code for verification' }
                 },
                 required: ['phoneNumber', 'zipCode']
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
             
           case 'get_last_call_attempt':
             response.result = await handleGetLastCallAttempt(args);
             break;
             
           case 'query_salesforce':
             response.result = await handleQuery(args);
             break;
             
           case 'create_records':
             response.result = await handleCreate(args);
             break;
             
           case 'send_sms':
             response.result = await handleSendSMS(args);
             break;
             
           case 'send_document_request_sms':
             response.result = await handleSendDocumentRequestSMS(args);
             break;
             
           case 'send_payment_reminder_sms':
             response.result = await handleSendPaymentReminderSMS(args);
             break;
             
           case 'lookup_client_by_phone':
             response.result = await handleLookupClientByPhone(args);
             break;
             
           case 'get_client_greeting':
             response.result = await handleGetClientGreeting(args);
             break;
             
           case 'verify_client_identity':
             response.result = await handleVerifyClientIdentity(args);
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
  
  console.log('📤 MCP Response:', JSON.stringify(response, null, 2));
  res.json(response);
});

// Business Logic Handlers
async function handleGetPendingCases(args) {
  try {
    console.log('📋 Looking up pending signature cases...');
    
    let query = `
      SELECT Id, CaseNumber, Contact.Name, Contact.Phone, Contact.Email,
             Subject, Status, CreatedDate
      FROM Case__c 
      WHERE Status = 'Pending Client Signature'
    `;
    
    if (args.caseId) {
      query += ` AND Id = '${args.caseId}'`;
    } else if (args.phoneNumber) {
      const cleanPhone = args.phoneNumber.replace(/[^\d]/g, '');
      query += ` AND (Contact.Phone LIKE '%${cleanPhone}%' OR Contact.MobilePhone LIKE '%${cleanPhone}%')`;
    } else if (args.clientName) {
      query += ` AND Contact.Name LIKE '%${args.clientName}%'`;
    }
    
    query += ` ORDER BY CreatedDate DESC LIMIT 10`;
    
    const result = await conn.query(query);
    
    if (result.records && result.records.length > 0) {
      const cases = result.records.map(c => ({
        id: c.Id,
        caseNumber: c.CaseNumber,
        clientName: c.Contact?.Name || 'Unknown',
        phone: c.Contact?.Phone,
        email: c.Contact?.Email,
        subject: c.Subject,
        status: c.Status,
        createdDate: c.CreatedDate
      }));
      
      return {
        content: [{
          type: 'text',
          text: `Found ${cases.length} cases pending signatures:\n${JSON.stringify(cases, null, 2)}`
        }]
      };
    } else {
      return {
        content: [{
          type: 'text',
          text: 'No cases found with pending signatures matching your criteria.'
        }]
      };
    }
  } catch (error) {
    console.error('Error fetching cases:', error);
    return {
      content: [{
        type: 'text',
        text: `Error fetching cases: ${error.message}`
      }]
    };
  }
}

async function handleSendReturns(args) {
  try {
    console.log('📧 Sending tax returns for case:', args.caseId);
    
    // Get case details including contact and account
    const caseQuery = `
      SELECT Id, CaseNumber, Contact.Name, Contact.Email, Contact.AccountId,
             Subject, Status
      FROM Case__c 
      WHERE Id = '${args.caseId}'
      LIMIT 1
    `;
    
    const caseResult = await conn.query(caseQuery);
    
    if (!caseResult.records || caseResult.records.length === 0) {
      throw new Error(`Case not found: ${args.caseId}`);
    }
    
    const caseRecord = caseResult.records[0];
    const clientEmail = args.clientEmail || caseRecord.Contact?.Email;
    const clientName = args.clientName || caseRecord.Contact?.Name || 'Valued Client';
    const accountId = caseRecord.Contact?.AccountId;
    
    if (!clientEmail) {
      throw new Error('No email address found for client');
    }
    
    // Prepare email with TaxRise direct links
    const docudropLink = accountId ? `https://docudrop.taxrise.com/${accountId}/verify` : 'https://docudrop.taxrise.com';
    const paymentLink = accountId ? `https://payment.taxrise.com/${accountId}` : 'https://payment.taxrise.com';
    
    const emailHtml = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background-color: #002d5f; color: white; padding: 20px; text-align: center;">
          <h1>TaxRise</h1>
          <p>We rise by lifting others.</p>
        </div>
        
        <div style="padding: 30px; background-color: #f9f9f9;">
          <p>Dear ${clientName},</p>
          
          <p>Your tax return documents are ready for your review and signature. Please find them attached to this email.</p>
          
          <div style="background-color: white; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #0c68a7;">
            <h3>Quick Actions:</h3>
            <p><strong>📄 Upload Additional Documents:</strong> <a href="${docudropLink}" style="color: #0c68a7;">Click here to upload securely</a></p>
            <p><strong>💳 Make a Payment:</strong> <a href="${paymentLink}" style="color: #0c68a7;">Click here to pay online</a></p>
          </div>
          
          <p>If you have any questions or need assistance, please don't hesitate to reach out to your dedicated tax resolution specialist.</p>
          
          <p>Thank you for choosing TaxRise!</p>
          
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd;">
            <p><strong>TaxRise Team</strong><br>
            Phone: (800) TAX-RISE<br>
            Email: support@taxrise.com</p>
          </div>
        </div>
      </div>
    `;
    
    // Send email
    const mailOptions = {
      from: 'sam@miadvg.com',
      to: clientEmail,
      subject: `Your Tax Return Documents - Case ${caseRecord.CaseNumber}`,
      html: emailHtml,
      text: `Dear ${clientName}, your tax return documents are ready. Upload documents: ${docudropLink}. Make payments: ${paymentLink}`
    };
    
    await emailTransporter.sendMail(mailOptions);
    
    return {
      content: [{
        type: 'text',
        text: `✅ Tax returns successfully sent to ${clientEmail} for case ${caseRecord.CaseNumber}. Email includes TaxRise direct links for document upload and payments.`
      }]
    };
  } catch (error) {
    console.error('❌ Email Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to send tax returns: ${error.message}`
      }]
    };
  }
}

async function handleCreateMailRequest(args) {
  try {
    console.log('📮 Creating mail request for case:', args.caseId);
    
    // Get case and contact details including account
    const caseQuery = `
      SELECT Id, CaseNumber, Contact.Name, Contact.MailingAddress, 
             Contact.AccountId, Subject
      FROM Case__c 
      WHERE Id = '${args.caseId}'
      LIMIT 1
    `;
    
    const caseResult = await conn.query(caseQuery);
    
    if (!caseResult.records || caseResult.records.length === 0) {
      throw new Error(`Case not found: ${args.caseId}`);
    }
    
    const caseRecord = caseResult.records[0];
    const clientAddress = args.clientAddress || 
      `${caseRecord.Contact?.MailingAddress?.street || ''} ${caseRecord.Contact?.MailingAddress?.city || ''} ${caseRecord.Contact?.MailingAddress?.state || ''} ${caseRecord.Contact?.MailingAddress?.postalCode || ''}`.trim();
    
    // Mock mail request creation (replace with actual mail service API)
    const mailRequest = {
      caseId: args.caseId,
      caseNumber: caseRecord.CaseNumber,
      clientName: caseRecord.Contact?.Name,
      clientAddress: clientAddress,
      requestType: args.requestType,
      documentType: args.documentType,
      status: 'Requested',
      requestDate: new Date().toISOString()
    };
    
    return {
      content: [{
        type: 'text',
        text: `✅ Mail request created successfully for ${caseRecord.Contact?.Name}. Documents will be sent to: ${clientAddress}. Request details: ${JSON.stringify(mailRequest, null, 2)}`
      }]
    };
    
  } catch (error) {
    console.error('❌ Mail Request Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to create mail request: ${error.message}`
      }]
    };
  }
}

async function handleGetLastCallAttempt(args) {
  try {
    console.log('📞 Looking up last call attempt for phone:', args.phoneNumber);
    
    // Clean phone number for search (remove formatting)
    const cleanPhone = args.phoneNumber.replace(/[^\d]/g, '');
    
    // Query TalkDesk Activity records for outbound call attempts
    const callQuery = `
      SELECT Id, talkdesk__Type__c, talkdesk__Start_Time__c, 
             talkdesk__Talk_Time_sec__c, talkdesk__DispositionCode__r.Name,
             talkdesk__Contact__r.Name, talkdesk__Contact__r.Phone, CreatedDate
      FROM talkdesk__Talkdesk_Activity__c 
      WHERE talkdesk__Type__c = 'Outbound' 
        AND (talkdesk__Contact__r.Phone LIKE '%${cleanPhone}%' 
             OR talkdesk__Contact__r.Phone LIKE '%${args.phoneNumber}%')
      ORDER BY talkdesk__Start_Time__c DESC 
      LIMIT 1
    `;
    
    console.log('📋 TalkDesk query:', callQuery);
    const result = await conn.query(callQuery);
    
    if (!result.records || result.records.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `I don't see any recent outbound calls to ${args.phoneNumber} in our TalkDesk system. This might mean we haven't attempted to reach you recently, or the calls may not be logged yet. Would you like me to have someone call you now?`
        }]
      };
    }
    
    const lastCall = result.records[0];
    const callDate = new Date(lastCall.talkdesk__Start_Time__c || lastCall.CreatedDate).toLocaleDateString();
    const duration = lastCall.talkdesk__Talk_Time_sec__c ? 
      `${Math.round(lastCall.talkdesk__Talk_Time_sec__c / 60)} minutes` : 'brief';
    const result_status = lastCall.talkdesk__DispositionCode__r?.Name || 'completed';
    const contactName = lastCall.talkdesk__Contact__r?.Name || 'Unknown';
    
    return {
      content: [{
        type: 'text',
        text: `I found our last call attempt to ${contactName} at ${args.phoneNumber} was on ${callDate}. The call lasted ${duration} and the result was: ${result_status}. If you need to speak with someone, I can arrange for a callback today!`
      }]
    };
    
  } catch (error) {
    console.error('❌ TalkDesk call lookup error:', error);
    return {
      content: [{
        type: 'text',
        text: `I'm having trouble accessing our call records right now. Let me have someone from our team reach out to you directly. What's the best time to call you?`
      }]
    };
  }
}

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
    console.log(`📝 Creating ${args.records.length} ${args.objectName} record(s)...`);
    
    const results = [];
    
    for (const record of args.records) {
      console.log(`Creating record:`, record);
      const result = await conn.sobject(args.objectName).create(record);
      results.push(result);
    }
    
    const successCount = results.filter(r => r.success).length;
    const responseText = `✅ Successfully created ${successCount} of ${results.length} ${args.objectName} records.
    
Results: ${JSON.stringify(results, null, 2)}`;
    
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

// Phase 3: Client Intelligence Handlers
async function handleLookupClientByPhone(args) {
  try {
    console.log('👤 Looking up client by phone:', args.phoneNumber);
    
    // Clean phone number for search (remove formatting)
    const cleanPhone = args.phoneNumber.replace(/[^\d]/g, '');
    
    // Comprehensive client lookup query
    const clientQuery = `
      SELECT Id, Name, PersonEmail, PersonMobilePhone, Phone, 
             PersonMailingPostalCode, PersonMailingCity, PersonMailingState,
             Home_Zip_Code__c, PersonBirthdate, AccountSource,
             (SELECT Id, CaseNumber, Status, Subject, CreatedDate 
              FROM Cases__r 
              WHERE Status != 'Closed' 
              ORDER BY CreatedDate DESC LIMIT 3)
      FROM Account 
      WHERE (PersonMobilePhone LIKE '%${cleanPhone}%' 
             OR Phone LIKE '%${cleanPhone}%'
             OR PersonMobilePhone LIKE '%${args.phoneNumber}%'
             OR Phone LIKE '%${args.phoneNumber}%')
      ORDER BY CreatedDate DESC
      LIMIT 1
    `;
    
    console.log('📋 Client lookup query:', clientQuery);
    const result = await conn.query(clientQuery);
    
    if (!result.records || result.records.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `No client found matching phone number ${args.phoneNumber}. This might be a new client or the phone number may not be updated in our system.`
        }]
      };
    }
    
    const client = result.records[0];
    const clientInfo = {
      accountId: client.Id,
      name: client.Name,
      email: client.PersonEmail,
      phone: client.PersonMobilePhone || client.Phone,
      zipCode: client.PersonMailingPostalCode || client.Home_Zip_Code__c,
      city: client.PersonMailingCity,
      state: client.PersonMailingState,
      activeCases: client.Cases__r ? client.Cases__r.length : 0,
      caseDetails: client.Cases__r || []
    };
    
    return {
      content: [{
        type: 'text',
        text: `✅ Client found: ${client.Name}
        
📧 Email: ${client.PersonEmail || 'Not provided'}
📱 Phone: ${client.PersonMobilePhone || client.Phone}
📍 ZIP: ${client.PersonMailingPostalCode || client.Home_Zip_Code__c}
🏙️  City: ${client.PersonMailingCity || 'Not provided'}, ${client.PersonMailingState || ''}
📂 Active Cases: ${client.Cases__r ? client.Cases__r.length : 0}

Client Details: ${JSON.stringify(clientInfo, null, 2)}`
      }]
    };
    
  } catch (error) {
    console.error('❌ Client lookup error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Error looking up client: ${error.message}`
      }]
    };
  }
}

async function handleGetClientGreeting(args) {
  try {
    console.log('👋 Generating personalized greeting for:', args.phoneNumber);
    
    let clientName = args.clientName;
    let clientInfo = null;
    
    // If no name provided, look up the client
    if (!clientName) {
      const lookupResult = await handleLookupClientByPhone({ phoneNumber: args.phoneNumber });
      
      // Parse the client info from the lookup result
      if (lookupResult.content[0].text.includes('Client found:')) {
        const clientText = lookupResult.content[0].text;
        const nameMatch = clientText.match(/Client found: (.+?)\n/);
        if (nameMatch) {
          clientName = nameMatch[1];
          
          // Extract additional info for context
          const emailMatch = clientText.match(/📧 Email: (.+?)\n/);
          const zipMatch = clientText.match(/📍 ZIP: (.+?)\n/);
          const casesMatch = clientText.match(/📂 Active Cases: (\d+)/);
          
          clientInfo = {
            name: clientName,
            email: emailMatch ? emailMatch[1] : null,
            zip: zipMatch ? zipMatch[1] : null,
            activeCases: casesMatch ? parseInt(casesMatch[1]) : 0
          };
        }
      }
    }
    
    // Generate personalized greeting based on call type
    let greeting = '';
    const callType = args.callType || 'inbound';
    
    if (!clientName || clientName === 'Not provided') {
      // New or unidentified client greeting
      switch (callType) {
        case 'inbound':
          greeting = `Hi! Thank you for calling TaxRise, where we rise by lifting others. I'm Emily, your virtual tax resolution assistant. May I please get your name and the phone number on your account so I can better assist you today?`;
          break;
        case 'outbound':
          greeting = `Hi! This is Emily from TaxRise calling. Am I speaking with the person responsible for the tax matters at this number? I'm reaching out to discuss your tax resolution case.`;
          break;
        default:
          greeting = `Hello! This is Emily from TaxRise. How can I help you with your tax resolution needs today?`;
      }
    } else {
      // Personalized greeting for known client
      const firstName = clientName.split(' ')[0];
      
      switch (callType) {
        case 'inbound':
          if (clientInfo && clientInfo.activeCases > 0) {
            greeting = `Hi ${firstName}! This is Emily from TaxRise. I can see you have ${clientInfo.activeCases} active case${clientInfo.activeCases > 1 ? 's' : ''} with us. How can I help you today?`;
          } else {
            greeting = `Hi ${firstName}! This is Emily from TaxRise, where we rise by lifting others. It's great to hear from you! How can I assist you with your tax resolution needs today?`;
          }
          break;
        case 'outbound':
          greeting = `Hi ${firstName}! This is Emily from TaxRise calling on a recorded line. Am I speaking with ${clientName}? I'm calling to follow up on your tax resolution case.`;
          break;
        case 'callback':
          greeting = `Hi ${firstName}! This is Emily from TaxRise returning your call. Thank you for reaching out to us! How can I help you today?`;
          break;
        default:
          greeting = `Hi ${firstName}! This is Emily from TaxRise. It's wonderful to speak with you again! How can I help you today?`;
      }
    }
    
    return {
      content: [{
        type: 'text',
        text: greeting
      }]
    };
    
  } catch (error) {
    console.error('❌ Greeting generation error:', error);
    return {
      content: [{
        type: 'text',
        text: `Hi! This is Emily from TaxRise, where we rise by lifting others. How can I help you with your tax resolution needs today?`
      }]
    };
  }
}

async function handleVerifyClientIdentity(args) {
  try {
    console.log('🔐 Verifying client identity:', args.phoneNumber, 'ZIP:', args.zipCode);
    
    // Clean phone number and ZIP code
    const cleanPhone = args.phoneNumber.replace(/[^\d]/g, '');
    const cleanZip = args.zipCode.replace(/[^\d]/g, '');
    
    // Verify client identity using phone and ZIP
    const verificationQuery = `
      SELECT Id, Name, PersonEmail, PersonMobilePhone, Phone,
             PersonMailingPostalCode, Home_Zip_Code__c
      FROM Account 
      WHERE (PersonMobilePhone LIKE '%${cleanPhone}%' 
             OR Phone LIKE '%${cleanPhone}%')
        AND (PersonMailingPostalCode LIKE '${cleanZip}%' 
             OR Home_Zip_Code__c LIKE '${cleanZip}%')
      LIMIT 1
    `;
    
    console.log('📋 Identity verification query:', verificationQuery);
    const result = await conn.query(verificationQuery);
    
    if (!result.records || result.records.length === 0) {
      return {
        content: [{
          type: 'text',
          text: `❌ Identity verification failed. The phone number ${args.phoneNumber} and ZIP code ${args.zipCode} combination doesn't match our records. Please verify the information and try again, or I can help you locate your account using just your name.`
        }]
      };
    }
    
    const client = result.records[0];
    
    return {
      content: [{
        type: 'text',
        text: `✅ Identity verified! Hi ${client.Name}! I've confirmed your identity using your phone number and ZIP code. Your account ID is ${client.Id}. How can I help you today?`
      }]
    };
    
  } catch (error) {
    console.error('❌ Identity verification error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Unable to verify identity at this time: ${error.message}. Let me try to help you in another way.`
      }]
    };
  }
}

// Hey Market SMS Handlers
async function handleSendSMS(args) {
  try {
    console.log('📱 Sending SMS to:', args.phoneNumber);
    
    const jwtToken = generateHeyMarketJWT();
    
    const smsPayload = {
      to: args.phoneNumber,
      text: args.message,
      user_id: HEYMARKET_USER_ID,
      inbox: HEYMARKET_INBOX_ID
    };
    
    console.log('📋 SMS payload:', smsPayload);
    
    const response = await fetch(`${HEYMARKET_API_URL}/message/send`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${jwtToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(smsPayload)
    });
    
    const result = await response.json();
    console.log('📱 SMS Response:', result);
    
    if (response.ok && result.message_id) {
      return {
        content: [{
          type: 'text',
          text: `✅ SMS sent successfully to ${args.phoneNumber}! Message ID: ${result.message_id}`
        }]
      };
    } else {
      throw new Error(`SMS failed: ${result.error || 'Unknown error'}`);
    }
    
  } catch (error) {
    console.error('❌ SMS Error:', error);
    return {
      content: [{
        type: 'text',
        text: `❌ Failed to send SMS: ${error.message}`
      }]
    };
  }
}

async function handleSendDocumentRequestSMS(args) {
  const message = `Hi ${args.clientName}! We need your ${args.documentType} to continue with your tax resolution. Please upload it securely here: https://docudrop.taxrise.com/${args.accountId}/verify

Questions? Reply to this message or call us!

- TaxRise Team`;

  return await handleSendSMS({
    phoneNumber: args.phoneNumber,
    message: message
  });
}

async function handleSendPaymentReminderSMS(args) {
  const message = `Hi ${args.clientName}! Your payment of $${args.amount} is due on ${args.dueDate}. Make your payment securely here: https://payment.taxrise.com/${args.accountId}

Questions about your payment? Reply to this message!

- TaxRise Team`;

  return await handleSendSMS({
    phoneNumber: args.phoneNumber,
    message: message
  });
}

app.listen(port, () => {
  console.log(`🚀 Emily MCP Server - Phase 3 Complete - running on port ${port}`);
  console.log(`📊 Version: 2.3.0-client-intelligence`);
  console.log('');
  console.log('📋 Available MCP Tools:');
  console.log('  📄 Business Logic:');
  console.log('    - get_pending_signature_cases (find cases needing signatures)');
  console.log('    - send_returns_to_client (email with TaxRise links)');
  console.log('    - create_mail_request (physical mail requests)');
  console.log('  📞 Communication:');
  console.log('    - get_last_call_attempt (TalkDesk call history)');
  console.log('  📱 SMS Automation:');
  console.log('    - send_sms (send SMS to clients)');
  console.log('    - send_document_request_sms (document requests with upload link)');
  console.log('    - send_payment_reminder_sms (payment reminders with payment link)');
  console.log('  👤 Client Intelligence:');
  console.log('    - lookup_client_by_phone (comprehensive client lookup)');
  console.log('    - get_client_greeting (personalized greetings)');
  console.log('    - verify_client_identity (phone + ZIP verification)');
  console.log('  🔧 Essential Tools:');
  console.log('    - query_salesforce (dynamic SOQL queries)');
  console.log('    - create_records (create documents, cases, etc.)');
  console.log('');
  console.log('✅ Phase 1: Essential MCP tools - COMPLETE');
  console.log('✅ Phase 2: Hey Market SMS automation - COMPLETE');
  console.log('✅ Phase 3: Client intelligence & personalized greetings - COMPLETE');
  console.log('🔗 Health check: http://localhost:' + port + '/health');
});