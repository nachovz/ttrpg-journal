import DOMPurify from 'dompurify';

/**
 * Allowlist of HTML tags produced by the Quill Snow editor.
 * Nothing outside this list will survive sanitization.
 */
const ALLOWED_TAGS = [
  'p', 'br',
  'strong', 'em', 'u', 's',
  'h1', 'h2', 'h3',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'a', 'span',
];

/**
 * Allowlist of attributes.
 * `rel` and `target` are included so links can safely open in a new tab.
 * `class` is needed for Quill's inline formatting spans.
 */
const ALLOWED_ATTR = ['href', 'target', 'rel', 'class'];

/**
 * Sanitize HTML produced by the Quill editor before rendering with
 * dangerouslySetInnerHTML. Strips any tags or attributes not in the
 * allowlist, neutralising XSS payloads from untrusted note content.
 */
export function sanitizeNoteHtml(html: string): string {
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    // Wrap output in a <body> so top-level text nodes are preserved
    FORCE_BODY: true,
  });
}
