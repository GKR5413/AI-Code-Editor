#!/usr/bin/env node

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import Anthropic from '@anthropic-ai/sdk';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from multiple locations
// 1. Local .env file in claude-agent-service directory
dotenv.config({ path: join(__dirname, '.env') });
// 2. Project root .env file
dotenv.config({ path: join(__dirname, '../../.env') });
// 3. Home directory .env file
dotenv.config({ path: join(process.env.HOME || process.env.USERPROFILE || '', '.claude.env') });

const CLAUDE_API_KEY = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
const CLAUDE_SERVICE_URL = process.env.CLAUDE_SERVICE_URL || 'http://localhost:6001';

if (!CLAUDE_API_KEY) {
  console.error('❌ Error: CLAUDE_API_KEY or ANTHROPIC_API_KEY not set');
  console.error('   Set it in your environment or .env file');
  process.exit(1);
}

const anthropic = new Anthropic({ apiKey: CLAUDE_API_KEY });

// Parse command line arguments
const args = process.argv.slice(2);
const command = args[0];

async function chat(prompt, options = {}) {
  const model = options.model || 'claude-3-5-sonnet-20241022';
  const temperature = options.temperature || 0.7;
  const maxTokens = options.maxTokens || 4096;

  try {
    console.log(`🤖 Using model: ${model}\n`);
    
    const response = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      temperature,
      messages: [{ role: 'user', content: prompt }]
    });

    const content = response.content[0].text;
    console.log(content);
    
    if (options.verbose) {
      console.log(`\n📊 Usage: ${JSON.stringify(response.usage, null, 2)}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

async function useService(prompt, options = {}) {
  const model = options.model || 'claude-3-5-sonnet-20241022';
  
  try {
    const response = await fetch(`${CLAUDE_SERVICE_URL}/api/claude/messages`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        messages: [{ role: 'user', content: prompt }],
        model,
        max_tokens: options.maxTokens || 4096,
        temperature: options.temperature || 0.7
      })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || `HTTP ${response.status}`);
    }

    const data = await response.json();
    const content = Array.isArray(data.content) 
      ? data.content.map(c => c.text).join('\n')
      : data.content;
    
    console.log(content);
    
    if (options.verbose) {
      console.log(`\n📊 Usage: ${JSON.stringify(data.usage, null, 2)}`);
    }
  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(`   Make sure Claude service is running at ${CLAUDE_SERVICE_URL}`);
    process.exit(1);
  }
}

function showHelp() {
  console.log(`
Claude CLI - Interact with Anthropic Claude AI

Usage:
  claude <prompt>                    Chat with Claude (direct API)
  claude --service <prompt>          Chat via local Claude service
  claude --model <model> <prompt>   Specify model
  claude --help                      Show this help

Options:
  --model <model>        Model to use (default: claude-3-5-sonnet-20241022)
  --service              Use local Claude service instead of direct API
  --temperature <num>     Temperature (0-1, default: 0.7)
  --max-tokens <num>     Max tokens (default: 4096)
  --verbose              Show usage statistics
  --help                 Show help

Examples:
  claude "Write a hello world in Python"
  claude --service "Explain quantum computing"
  claude --model claude-3-opus-20240229 "Write a poem"
  claude --temperature 0.3 "Write code"

Available Models:
  - claude-3-5-sonnet-20241022 (default)
  - claude-3-5-opus-20241022
  - claude-3-5-haiku-20241022
  - claude-3-opus-20240229
  - claude-3-sonnet-20240229
  - claude-3-haiku-20240307
`);
}

// Main execution
if (!command || command === '--help' || command === '-h') {
  showHelp();
  process.exit(0);
}

// Parse options
const options = {};
let prompt = '';
let useServiceFlag = false;

for (let i = 0; i < args.length; i++) {
  const arg = args[i];
  
  if (arg === '--service') {
    useServiceFlag = true;
  } else if (arg === '--model' && args[i + 1]) {
    options.model = args[++i];
  } else if (arg === '--temperature' && args[i + 1]) {
    options.temperature = parseFloat(args[++i]);
  } else if (arg === '--max-tokens' && args[i + 1]) {
    options.maxTokens = parseInt(args[++i]);
  } else if (arg === '--verbose') {
    options.verbose = true;
  } else if (!arg.startsWith('--')) {
    prompt = arg;
  }
}

// If prompt is empty, read from stdin
if (!prompt) {
  const stdin = readFileSync(0, 'utf-8');
  prompt = stdin.trim();
}

if (!prompt) {
  console.error('❌ Error: No prompt provided');
  showHelp();
  process.exit(1);
}

// Execute
if (useServiceFlag) {
  useService(prompt, options).catch(console.error);
} else {
  chat(prompt, options).catch(console.error);
}

