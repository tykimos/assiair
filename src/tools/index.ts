import type { ToolDefinition } from '@/types';
import { vfs_read, vfs_write, vfs_list, vfs_delete } from './vfs';
import { jsExecute } from './js-sandbox';
import { pythonExecute } from './python-sandbox';
import { httpRequest } from './http-request';
import { kbSearchTool } from './kb-search';
import { generateDocumentTool } from './generate-document';
import { sendEmailTool } from './send-email';
import { fetchDataTool } from './fetch-data';
import { contextLookupTool } from './context-lookup';
import { supabaseQueryTool } from './supabase-query';
import { userLookupTool } from './user-lookup';

export interface ToolImplementation {
  definition: ToolDefinition;
  execute: (args: Record<string, unknown>, toolConfig?: Record<string, unknown>) => Promise<unknown>;
}

const TOOL_REGISTRY: Record<string, ToolImplementation> = {
  vfs_read: {
    definition: {
      type: 'function',
      function: {
        name: 'vfs_read',
        description: '가상 파일 시스템에서 파일을 읽습니다',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '읽을 파일 경로' },
          },
          required: ['path'],
        },
      },
    },
    execute: async (args) => vfs_read(args.path as string),
  },
  vfs_write: {
    definition: {
      type: 'function',
      function: {
        name: 'vfs_write',
        description: '가상 파일 시스템에 파일을 씁니다',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '쓸 파일 경로' },
            content: { type: 'string', description: '파일 내용' },
          },
          required: ['path', 'content'],
        },
      },
    },
    execute: async (args) => vfs_write(args.path as string, args.content as string),
  },
  vfs_list: {
    definition: {
      type: 'function',
      function: {
        name: 'vfs_list',
        description: '가상 파일 시스템의 디렉토리 내 파일 목록을 반환합니다',
        parameters: {
          type: 'object',
          properties: {
            directory: { type: 'string', description: '디렉토리 경로' },
          },
          required: ['directory'],
        },
      },
    },
    execute: async (args) => vfs_list(args.directory as string),
  },
  vfs_delete: {
    definition: {
      type: 'function',
      function: {
        name: 'vfs_delete',
        description: '가상 파일 시스템에서 파일을 삭제합니다',
        parameters: {
          type: 'object',
          properties: {
            path: { type: 'string', description: '삭제할 파일 경로' },
          },
          required: ['path'],
        },
      },
    },
    execute: async (args) => vfs_delete(args.path as string),
  },
  js_sandbox: {
    definition: {
      type: 'function',
      function: {
        name: 'js_sandbox',
        description: '격리된 환경에서 JavaScript 코드를 실행합니다',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '실행할 JavaScript 코드' },
          },
          required: ['code'],
        },
      },
    },
    execute: async (args) => jsExecute(args.code as string),
  },
  python_sandbox: {
    definition: {
      type: 'function',
      function: {
        name: 'python_sandbox',
        description: '격리된 환경에서 Python 코드를 실행합니다 (Pyodide)',
        parameters: {
          type: 'object',
          properties: {
            code: { type: 'string', description: '실행할 Python 코드' },
          },
          required: ['code'],
        },
      },
    },
    execute: async (args) => pythonExecute(args.code as string),
  },
  http_request: {
    definition: {
      type: 'function',
      function: {
        name: 'http_request',
        description: '허용된 도메인에 HTTP 요청을 보냅니다',
        parameters: {
          type: 'object',
          properties: {
            url: { type: 'string', description: '요청 URL' },
            method: { type: 'string', enum: ['GET', 'POST'], description: 'HTTP 메서드' },
            headers: { type: 'object', description: 'HTTP 헤더' },
            body: { type: 'string', description: '요청 본문 (POST만)' },
          },
          required: ['url'],
        },
      },
    },
    execute: async (args) => httpRequest(
      args.url as string,
      {
        method: args.method as string | undefined,
        headers: args.headers as Record<string, string> | undefined,
        body: args.body as string | undefined,
      }
    ),
  },
  kb_search: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'kb_search',
        description: '설정된 지식베이스에서 정보를 검색합니다',
        parameters: {
          type: 'object',
          properties: {
            query: { type: 'string', description: '검색할 내용' },
            kb_id: { type: 'string', description: '특정 지식베이스 ID (선택사항)' },
          },
          required: ['query'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      kbSearchTool(args.query as string, args.kb_id as string | undefined),
  },
  generate_document: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'generate_document',
        description: '공문 PDF를 생성합니다. content에 JSON을 전달하세요: {"document_type":"official_letter","recipient_org":"수신기관","recipient_name":"이름"}. 행사 정보는 템플릿에 포함되어 있으므로 수신자 정보만 필요합니다.',
        parameters: {
          type: 'object',
          properties: {
            type: { type: 'string', enum: ['pdf'], description: '문서 형식' },
            content: { type: 'string', description: '문서 내용. 공문은 JSON 문자열, 일반 문서는 텍스트.' },
            filename: { type: 'string', description: '파일 이름 (예: 공문_참석요청.pdf)' },
          },
          required: ['type', 'content', 'filename'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      generateDocumentTool(args.type as string, args.content as string, args.filename as string),
  },
  send_email: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'send_email',
        description: '이메일을 전송합니다.',
        parameters: {
          type: 'object',
          properties: {
            to: { type: 'string', description: '수신자 이메일 주소' },
            subject: { type: 'string', description: '이메일 제목' },
            body: { type: 'string', description: '이메일 본문' },
            attachments: {
              type: 'array',
              items: { type: 'string' },
              description: '첨부 파일 URL 목록 (선택사항)',
            },
          },
          required: ['to', 'subject', 'body'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      sendEmailTool(
        args.to as string,
        args.subject as string,
        args.body as string,
        args.attachments as string[] | undefined
      ),
  },
  context_lookup: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'context_lookup',
        description: '컨텍스트 제공자에 저장된 데이터를 키로 조회합니다',
        parameters: {
          type: 'object',
          properties: {
            key: { type: 'string', description: '조회할 컨텍스트 키 (예: event-info)' },
          },
          required: ['key'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      contextLookupTool(args.key as string),
  },
  supabase_query: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'supabase_query',
        description: 'Supabase 데이터베이스에서 데이터를 조회합니다',
        parameters: {
          type: 'object',
          properties: {
            table: { type: 'string', description: '조회할 테이블 이름' },
            select: { type: 'string', description: '선택할 컬럼 (기본값: *)' },
            eq: {
              type: 'object',
              description: '일치 조건 필터 (key-value 쌍)',
            },
            limit: { type: 'number', description: '결과 개수 제한 (기본값: 10)' },
          },
          required: ['table'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      supabaseQueryTool(
        args.table as string,
        (args.select as string) ?? '*',
        args.eq as Record<string, string> | undefined,
        (args.limit as number) ?? 10
      ),
  },
  fetch_data: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'fetch_data',
        description: '설정된 서비스 엔드포인트에서 데이터를 조회합니다',
        parameters: {
          type: 'object',
          properties: {
            endpoint_id: { type: 'string', description: '서비스 엔드포인트 ID' },
            params: {
              type: 'object',
              description: '요청 파라미터 (선택사항)',
            },
          },
          required: ['endpoint_id'],
        },
      },
    },
    execute: async (args: Record<string, unknown>) =>
      fetchDataTool(args.endpoint_id as string, args.params as Record<string, unknown> | undefined),
  },
  user_lookup: {
    definition: {
      type: 'function' as const,
      function: {
        name: 'user_lookup',
        description: 'user_token으로 registrations 테이블(air_user_token 필드)에서 사용자 정보를 조회합니다. context_lookup으로 user_token을 먼저 얻은 뒤 이 도구에 전달하세요.',
        parameters: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'URL에서 캡처한 user_token 값' },
          },
          required: ['token'],
        },
      },
    },
    execute: async (args: Record<string, unknown>, toolConfig?: Record<string, unknown>) =>
      userLookupTool(args.token as string, toolConfig),
  },
};

export function getToolImplementation(toolId: string): ToolImplementation | undefined {
  return TOOL_REGISTRY[toolId];
}

export function getToolDefinitions(toolIds: string[]): ToolDefinition[] {
  return toolIds
    .map(id => TOOL_REGISTRY[id]?.definition)
    .filter((d): d is ToolDefinition => d !== undefined);
}

export async function executeTool(
  toolId: string,
  args: Record<string, unknown>,
  runtimeContext?: Record<string, unknown>
): Promise<unknown> {
  const tool = TOOL_REGISTRY[toolId];
  if (!tool) {
    return { ok: false, error: `Unknown tool: ${toolId}` };
  }
  // For context_lookup, check runtime context first, then fall through to
  // the server-side registry so values persisted by user_lookup (e.g. user_info)
  // are accessible across pipelines.
  if (toolId === 'context_lookup' && runtimeContext) {
    const key = args.key as string;
    const value = runtimeContext[key];
    if (value !== undefined) {
      const result = { ok: true, data: value };
      console.log(`[TOOL_EXEC] ${toolId} args:`, JSON.stringify(args), 'result:', JSON.stringify(result));
      return result;
    }
    // Key not in runtimeContext — fall through to regular tool (server singleton)
  }

  // Extract per-tool DB config from runtimeContext
  const toolConfigs = runtimeContext?.__tool_configs as Record<string, Record<string, unknown>> | undefined;
  const toolConfig = toolConfigs?.[toolId];

  console.log(`[TOOL_EXEC] ${toolId} args:`, JSON.stringify(args));
  const result = await tool.execute(args, toolConfig);
  console.log(`[TOOL_EXEC] ${toolId} result:`, JSON.stringify(result));
  return result;
}

const BUILTIN_TOOL_IDS = new Set(Object.keys(TOOL_REGISTRY));

export function getAllToolIds(): string[] {
  return Object.keys(TOOL_REGISTRY);
}

export function getToolMeta(id: string): { name: string; description: string } | undefined {
  const tool = TOOL_REGISTRY[id];
  if (!tool) return undefined;
  return {
    name: tool.definition.function.name,
    description: tool.definition.function.description,
  };
}

export function isBuiltinTool(id: string): boolean {
  return BUILTIN_TOOL_IDS.has(id);
}

export function registerCustomTool(
  id: string,
  description: string,
  parameters: { name: string; type: string; description: string; required: boolean }[]
): void {
  const props: Record<string, unknown> = {};
  const required: string[] = [];
  for (const p of parameters) {
    props[p.name] = { type: p.type, description: p.description };
    if (p.required) required.push(p.name);
  }

  TOOL_REGISTRY[id] = {
    definition: {
      type: 'function',
      function: {
        name: id,
        description,
        parameters: {
          type: 'object',
          properties: props,
          required,
        },
      },
    },
    execute: async (args) => {
      return { ok: true, tool: id, args, note: 'Custom tool — no server-side implementation' };
    },
  };
}

export function removeCustomTool(id: string): boolean {
  if (BUILTIN_TOOL_IDS.has(id)) return false;
  return delete TOOL_REGISTRY[id];
}
