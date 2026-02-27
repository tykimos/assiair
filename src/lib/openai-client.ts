import OpenAI, { AzureOpenAI } from 'openai';

let cachedClient: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
  if (cachedClient) return cachedClient;

  const azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const azureKey = process.env.AZURE_OPENAI_API_KEY;

  if (azureEndpoint && azureKey) {
    const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-04-01-preview';
    cachedClient = new AzureOpenAI({
      endpoint: azureEndpoint,
      apiKey: azureKey,
      apiVersion,
    });
  } else {
    cachedClient = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY || 'missing',
    });
  }

  return cachedClient;
}

export function getOrchModel(): string {
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    return process.env.AZURE_OPENAI_DEPLOYMENT_ORCH || 'gpt-4o-mini';
  }
  return process.env.OPENAI_MODEL_ORCH || 'gpt-4o-mini';
}

export function getExecModel(): string {
  if (process.env.AZURE_OPENAI_ENDPOINT) {
    return process.env.AZURE_OPENAI_DEPLOYMENT_EXEC || 'gpt-4o';
  }
  return process.env.OPENAI_MODEL_EXEC || 'gpt-4o';
}
