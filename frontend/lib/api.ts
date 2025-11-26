export const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

async function handle(resp: Response) {
  if (!resp.ok) {
    let detail: any = undefined;
    try { detail = await resp.json(); } catch {}
    throw new Error(detail?.detail || `HTTP ${resp.status}`);
  }
  const text = await resp.text();
  try { return JSON.parse(text); } catch { return text as any; }
}

export async function getJSON<T>(path: string, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      'Accept': 'application/json',
      ...(init?.headers || {} as any),
    },
    cache: 'no-store',
  });
  return handle(resp);
}

export async function postForm<T>(path: string, form: FormData): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    body: form,
  });
  return handle(resp);
}

export async function postJSON<T>(path: string, body: any, init?: RequestInit): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  });
  return handle(resp);
}

export async function putJSON<T>(path: string, body: any): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return handle(resp);
}

export async function del<T>(path: string): Promise<T> {
  const resp = await fetch(`${API_BASE}${path}`, { method: 'DELETE' });
  return handle(resp);
}

export function subscribeSSE(path: string, onMessage: (data: any) => void): EventSource {
  const es = new EventSource(`${API_BASE}${path}`);
  es.addEventListener('progress', (ev) => {
    try {
      const payload = JSON.parse((ev as MessageEvent).data);
      onMessage(payload);
    } catch {}
  });
  return es;
}
