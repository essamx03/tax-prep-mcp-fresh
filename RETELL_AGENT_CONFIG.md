# Retell AI Agent Configuration Guide

## 🤖 Agent System Prompt

```
You are a TaxRise tax preparation assistant with access to Salesforce through MCP tools. 

KEY PRINCIPLES:
1. Always start unknown operations by calling describe_object_fields to learn schema
2. Use map_intent_to_fields to understand what fields to set based on user requests  
3. Query existing data before creating to avoid duplicates
4. Confirm destructive actions with users
5. Use Case__c custom object, NOT standard Case object

CRITICAL BUSINESS RULES:
- Tax Returns: Doc_Category__c="Tax Prep", Doc_Type__c="Tax Return"
- Case lookup field: Case__c (points to Case__c custom object)
- Never set Name field on Document__c (auto-generated)
- Check Prep_Status__c="Pending Signatures" for pending documents

RESPONSE STYLE: Conversational, confirm actions, provide clear next steps.
```

## 🛠️ Tool Configuration

### **Recommended Tool Set (All 9 tools):**

```json
{
  "tools": [
    "describe_global_objects",
    "describe_object_fields", 
    "query_salesforce",
    "create_records",
    "update_records",
    "send_returns_to_client",
    "get_document_taxonomy",
    "map_intent_to_fields",
    "discover_data_patterns"
  ]
}
```

### **Minimal Tool Set (4 tools for simple use cases):**

```json
{
  "tools": [
    "describe_object_fields",
    "query_salesforce", 
    "create_records",
    "map_intent_to_fields"
  ]
}
```

## 📋 Example Conversation Flows

### **Tax Return Creation**
```
User: "File my 2024 tax return"
Agent: 
1. map_intent_to_fields("file tax return", "Document__c")
2. "I need to find your case first. What's your name or phone number?"
3. query_salesforce to find Case__c
4. create_records with proper Doc_Category__c and Doc_Type__c
5. "✓ Created 2024 IRS tax return. Would you like me to email it?"
```

### **Status Check**
```
User: "What documents are pending signatures?"
Agent:
1. query_salesforce("SELECT Name, Tax_Year__c, Agency__c FROM Document__c WHERE Case__c = '[id]' AND Prep_Status__c = 'Pending Signatures'")
2. "You have 3 pending documents: 2024 IRS, 2024 State, and 2023 amended return"
```

### **Email Documents**  
```
User: "Email my returns"
Agent:
1. send_returns_to_client(case_id) 
2. "✓ Emailed your tax returns with TaxRise letterhead to your registered email"
```

## ⚠️ Common Issues & Solutions

### **"Case not found" errors**
- Always use `Case__c` custom object, NOT standard `Case`
- Search by: `Client__r.Name LIKE '%[name]%'` or `Client__r.Phone = '[phone]'`

### **"Field integrity" errors**  
- Use `describe_object_fields` to see required fields and types
- Check picklist values with `get_document_taxonomy`

### **"Unknown tool" errors**
- Verify tool names match exactly (underscore_case, no dots)
- Check MCP server logs for actual available tools

## 🔧 Testing Commands

Test these scenarios with your configured agent:

1. **"What tax years do I have pending?"**
2. **"Create a 2024 tax return"** 
3. **"Email my returns"**
4. **"Upload a W2 for 2023"**

## 📊 Success Metrics

Monitor these in Retell:
- Tool call success rate (should be >95%)
- User satisfaction with responses
- Completion rate for multi-step workflows
- Error rate for Document__c creation

## 🚀 Deployment Checklist

- [ ] MCP server deployed to Render
- [ ] Retell agent configured with correct tools
- [ ] System prompt includes business rules
- [ ] Test cases validated
- [ ] Error handling tested
- [ ] Knowledge base accessible to agent
