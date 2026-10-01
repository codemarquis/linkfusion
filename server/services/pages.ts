/**
 * Small server-rendered pages for the redirect flow (unlock form, link
 * unavailable). Every dynamic value is HTML-escaped.
 */
const escapeHtml = (s: string) =>
  s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, body: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${escapeHtml(title)} · LinkFusion</title>
<style>
:root{color-scheme:light dark}body{margin:0;min-height:100vh;display:grid;place-items:center;font:16px/1.5 system-ui,sans-serif;background:#f6f7f9;color:#111}
@media (prefers-color-scheme:dark){body{background:#0d1117;color:#e6edf3}.card{background:#161b22;border-color:#30363d}input{background:#0d1117;color:#e6edf3;border-color:#30363d}}
.card{max-width:380px;width:calc(100% - 32px);padding:28px;border:1px solid #d0d7de;border-radius:12px;background:#fff}
h1{font-size:1.25rem;margin:0 0 8px}p{margin:0 0 16px;opacity:.8}label{display:block;font-weight:600;margin-bottom:6px}
input{width:100%;box-sizing:border-box;padding:10px;border:1px solid #d0d7de;border-radius:8px;font:inherit}
button{margin-top:12px;width:100%;padding:10px;border:0;border-radius:8px;background:#2563eb;color:#fff;font:inherit;font-weight:600;cursor:pointer}
.error{color:#cf222e;margin:8px 0 0}a{color:#2563eb}
</style></head><body><main class="card">${body}</main></body></html>`;
}

export function unlockPage(code: string, error?: string): string {
  const safeCode = escapeHtml(code);
  return layout(
    "Password required",
    `<h1>🔒 Password required</h1><p>This link is protected. Enter the password to continue.</p>
<form method="post" action="/${safeCode}/unlock">
<label for="password">Password</label>
<input id="password" name="password" type="password" autocomplete="off" required maxlength="128" autofocus>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ""}
<button type="submit">Continue</button></form>`,
  );
}

const reasons: Record<string, [string, string]> = {
  not_found: ["Link not found", "This short link doesn't exist."],
  inactive: ["Link disabled", "The owner has disabled this link."],
  expired: ["Link expired", "This link has expired."],
  limit_reached: ["Link unavailable", "This link has reached its click limit."],
};

export function unavailablePage(kind: keyof typeof reasons | string): string {
  const [title, text] = reasons[kind] ?? reasons.not_found;
  return layout(title, `<h1>${escapeHtml(title)}</h1><p>${escapeHtml(text)}</p><p><a href="/">Go to LinkFusion</a></p>`);
}
