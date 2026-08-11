// Deliberately tiny: Announcements only ever need Bold, Italic, and Link,
// written by the toolbar in the compose panel (**text**, *text*,
// [text](url)). Not a general purpose markdown parser.

function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Only http(s) links render as a real, clickable anchor, anything else
// (javascript:, data:, etc.) is left as plain escaped text so a pasted
// URL can never become an XSS vector.
function safeHref(escapedUrl) {
  // The link regex runs after escapeHtml, so an "&" typed by the author
  // (common in query strings) arrives here as "&amp;", decode it back
  // before validating so links with query params still work.
  const url = escapedUrl.replace(/&amp;/g, '&');
  try {
    const parsed = new URL(url, 'https://placeholder.invalid');
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:') return url;
  } catch {
    // fall through
  }
  return null;
}

export function renderAnnouncementHtml(message) {
  let html = escapeHtml(message || '');

  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (match, text, url) => {
    const href = safeHref(url);
    if (!href) return match;
    return `<a href="${escapeHtml(href)}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });

  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  html = html.replace(/\n/g, '<br />');

  return html;
}
