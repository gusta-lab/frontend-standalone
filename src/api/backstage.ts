import type { Template, ScaffolderTask } from '../types';

let cachedToken: string | null = null;

async function getGuestToken(): Promise<string | null> {
  if (cachedToken) return cachedToken;
  try {
    const res = await fetch('/api/auth/guest/refresh', {
      method: 'GET',
      credentials: 'include',
    });
    if (res.ok) {
      const data = await res.json() as { backstageIdentity?: { token?: string } };
      cachedToken = data.backstageIdentity?.token ?? null;
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

export async function listTasks(): Promise<ScaffolderTask[]> {
  const data = await req<{ tasks: ScaffolderTask[] }>('/api/scaffolder/v2/tasks');
  return data.tasks ?? [];
}
