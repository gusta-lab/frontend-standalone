export interface WorkflowRun {
  id: number;
  status: 'queued' | 'in_progress' | 'completed';
  conclusion: 'success' | 'failure' | 'cancelled' | 'timed_out' | null;
  html_url: string;
  created_at: string;
}

export function parseGithubRepo(url: string): { owner: string; repo: string } | null {
  const match = url.match(/github\.com\/([^/]+)\/([^/?#]+)/);
  if (!match) return null;
  return { owner: match[1], repo: match[2].replace(/\.git$/, '') };
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
