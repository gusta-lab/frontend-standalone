export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | null;
  html_url: string;
  created_at: string;
}

export function parseGithubPR(url: string): { owner: string; repo: string; number: number } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2], number: parseInt(match[3]) };
}

export async function getPRPlanComment(owner: string, repo: string, prNumber: number): Promise<string | null> {
  try {
    const res = await fetch(`/github-api/repos/${owner}/${repo}/issues/${prNumber}/comments`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const comments = await res.json() as Array<{ body: string }>;
    const planComment = comments.find(c => c.body.includes('Terraform Plan'));
    if (!planComment) return null;
    const match = planComment.body.match(/```(?:hcl)?\n([\s\S]*?)```/);
    return match ? match[1].trim() : planComment.body;
  } catch {
    return null;
  }
}

export async function mergePR(owner: string, repo: string, prNumber: number): Promise<void> {
  const res = await fetch(`/github-api/repos/${owner}/${repo}/pulls/${prNumber}/merge`, {
    method: 'PUT',
    headers: {
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ merge_method: 'squash' }),
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { message?: string };
    throw new Error(data.message ?? `Erro ${res.status}`);
  }
}

export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
}

export async function getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
  try {
    const res = await fetch(`/github-api/repos/${owner}/${repo}/contents/${path}`, {
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = await res.json() as { content: string; encoding: string };
    if (data.encoding !== 'base64') return null;
    return atob(data.content.replace(/\n/g, ''));
  } catch {
    return null;
  }
}

export function parseTfvars(content: string): Record<string, string | number> {
  const result: Record<string, string | number> = {};
  for (const line of content.split('\n')) {
    const match = line.match(/^(\w+)\s*=\s*(.+)$/);
    if (!match) continue;
    const val = match[2].trim();
    const stripped = val.startsWith('"') && val.endsWith('"') ? val.slice(1, -1) : val;
    const num = Number(stripped);
    result[match[1]] = stripped !== '' && !isNaN(num) ? num : stripped;
  }
  return result;
}

// Retorna:
//   WorkflowRun — dados reais
//   null        — nenhuma execução encontrada ainda
//   undefined   — falha na requisição (rate limit, rede) → caller preserva estado anterior
export async function getLatestWorkflowRun(
  owner: string,
  repo: string,
): Promise<WorkflowRun | null | undefined> {
  try {
    const res = await fetch(
      `/github-api/repos/${owner}/${repo}/actions/runs?per_page=1&branch=main&event=push`,
      { headers: { Accept: 'application/vnd.github+json' } },
    );

    if (res.status === 403 || res.status === 429) return undefined; // rate limit
    if (!res.ok) return undefined;

    const data = await res.json() as { workflow_runs: WorkflowRun[] };
    return data.workflow_runs[0] ?? null;
  } catch {
    return undefined;
  }
}
