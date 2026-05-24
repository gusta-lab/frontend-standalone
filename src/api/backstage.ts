import type { Template, ScaffolderTask, CatalogEntity, ScaffoldOutput } from '../types';
import { PROVIDER_DISPLAY } from '../providers';

let cachedToken: string | null = null;
let cachedAt = 0;
const TOKEN_TTL_MS = 55 * 60 * 1000;

async function getGuestToken(): Promise<string | null> {
  if (cachedToken && Date.now() - cachedAt < TOKEN_TTL_MS) return cachedToken;
  cachedToken = null;
  try {
    const res = await fetch('/api/auth/guest/refresh', {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json() as { backstageIdentity?: { token?: string } };
      cachedToken = data.backstageIdentity?.token ?? null;
      cachedAt = Date.now();
      return cachedToken;
    }
  } catch {
    // sem token, tenta chamada sem autenticação
  }
  return null;
}

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const token = await getGuestToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };

  const res = await fetch(path, {
    ...options,
    credentials: 'include',
    headers: { ...headers, ...(options?.headers as Record<string, string> ?? {}) },
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Erro ${res.status}: ${text}`);
  }

  return res.json() as Promise<T>;
}

export async function getTemplatesByProvider(provider: string): Promise<Template[]> {
  const all = await req<Template[]>('/api/catalog/entities?filter=kind=Template');
  const byTag = all.filter(t => t.metadata.tags?.includes(provider));
  if (byTag.length > 0) return byTag;
  return all.filter(t => t.metadata.name.startsWith(`${provider}-`));
}

export async function getTemplate(name: string): Promise<Template> {
  const all = await req<Template[]>(
    `/api/catalog/entities?filter=kind=Template,metadata.name=${name}`
  );
  if (!all.length) throw new Error(`Template "${name}" não encontrado`);
  return all[0];
}

export async function submitTemplate(
  templateName: string,
  values: Record<string, unknown>
): Promise<{ id: string }> {
  return req<{ id: string }>('/api/scaffolder/v2/tasks', {
    method: 'POST',
    body: JSON.stringify({
      templateRef: `template:default/${templateName}`,
      values,
    }),
  });
}

export async function getTask(id: string): Promise<ScaffolderTask> {
  return req<ScaffolderTask>(`/api/scaffolder/v2/tasks/${id}`);
}

export async function getEntityByRef(entityRef: string): Promise<CatalogEntity> {
  return req<CatalogEntity>(`/api/catalog/entities/by-ref/${entityRef}`);
}

export async function listTasks(): Promise<ScaffolderTask[]> {
  const data = await req<{ tasks: ScaffolderTask[] }>('/api/scaffolder/v2/tasks');
  return data.tasks ?? [];
}

export async function getGustaLabResources(): Promise<CatalogEntity[]> {
  return req<CatalogEntity[]>(
    '/api/catalog/entities?filter=metadata.tags=gustalab-managed'
  );
}

// Retorna quais providers conhecidos têm templates no catálogo, com contagem.
export async function getActiveProviders(): Promise<Record<string, number>> {
  const all = await req<Template[]>('/api/catalog/entities?filter=kind=Template');
  const counts: Record<string, number> = {};
  for (const id of Object.keys(PROVIDER_DISPLAY)) {
    const byTag = all.filter(t => t.metadata.tags?.includes(id));
    const count = byTag.length > 0
      ? byTag.length
      : all.filter(t => t.metadata.name.startsWith(`${id}-`)).length;
    if (count > 0) counts[id] = count;
  }
  return counts;
}

export type StepStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';

// Abre o SSE do Backstage Scaffolder com auth via fetch (EventSource não suporta headers).
export async function streamTask(
  id: string,
  onStep: (stepId: string, status: StepStatus) => void,
  onComplete: (result: 'succeeded' | 'failed' | 'cancelled', output: ScaffoldOutput | null) => void,
  signal: AbortSignal,
): Promise<void> {
  const token = await getGuestToken();
  let res: Response;
  try {
    res = await fetch(`/api/scaffolder/v2/tasks/${id}/eventstream`, {
      credentials: 'include',
      headers: {
        Accept: 'text/event-stream',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
  } catch {
    return;
  }

  if (!res.ok || !res.body) return;

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += decoder.decode(value, { stream: true });

      const lines = buf.split('\n');
      buf = lines.pop() ?? '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        try {
          const json = JSON.parse(line.slice(6)) as {
            type?: string;
            body?: {
              stepId?: string;
              status?: string;
              message?: string;
              output?: ScaffoldOutput;
            };
          };

          if (json.type === 'log' && json.body?.stepId && json.body?.status) {
            onStep(json.body.stepId, json.body.status as StepStatus);
          } else if (json.type === 'completion') {
            const msg = json.body?.message ?? '';
            const result: 'succeeded' | 'failed' | 'cancelled' =
              msg.includes('failed') ? 'failed'
              : msg.includes('cancel') ? 'cancelled'
              : 'succeeded';
            onComplete(result, json.body?.output ?? null);
            return;
          }
        } catch {
          // linha malformada, ignora
        }
      }
    }
  } finally {
    reader.cancel();
  }
}
