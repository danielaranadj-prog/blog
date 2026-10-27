import { escapeHtml } from './planner-utils.js';

export function mountPublicationValidation({ before, focusContent, root = document }) {
  const summary = root.createElement('section');
  summary.className = 'publication-errors';
  summary.setAttribute('role', 'alert');
  summary.setAttribute('aria-label', 'Campos pendientes para publicar');
  summary.hidden = true;
  before.before(summary);
  let attempted = false;
  let marked = [];

  function targetFor(field) {
    return field === 'tiny-editor'
      ? root.querySelector('#writing-card .tox-tinymce') || root.getElementById('tiny-editor')
      : root.getElementById(field);
  }
  function clearMarks() {
    for (const { target, message, invalid, describedBy } of marked) {
      target.classList.remove('publication-invalid');
      if (invalid === null) target.removeAttribute('aria-invalid');
      else target.setAttribute('aria-invalid', invalid);
      if (describedBy === null) target.removeAttribute('aria-describedby');
      else target.setAttribute('aria-describedby', describedBy);
      message.remove();
    }
    marked = [];
  }
  function focus(field) {
    const target = targetFor(field);
    if (!target) return;
    for (let parent = target.parentElement; parent; parent = parent.parentElement) {
      if (parent.tagName === 'DETAILS') parent.open = true;
    }
    if (field === 'tiny-editor' && focusContent) focusContent();
    else target.focus({ preventScroll: true });
    target.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  summary.addEventListener('click', event => {
    const button = event.target.closest('[data-audit-field]');
    if (button) focus(button.dataset.auditField);
  });
  function update(findings) {
    if (!attempted) return;
    clearMarks();
    const errors = findings.filter(finding => finding.level === 'error');
    summary.hidden = errors.length === 0;
    summary.innerHTML = errors.length
      ? `<h2>Antes de publicar, completa ${errors.length === 1 ? 'este pendiente' : `estos ${errors.length} pendientes`}</h2><ul>${errors.map(error => `<li><button type="button" class="text-action" data-audit-field="${escapeHtml(error.field || 'tiny-editor')}">${escapeHtml(error.message)}</button></li>`).join('')}</ul><p>Pulsa un pendiente para ir al lugar exacto.</p>` : '';
    const grouped = new Map();
    for (const error of errors) {
      const field = error.field || 'tiny-editor';
      grouped.set(field, [...(grouped.get(field) || []), error.message]);
    }
    for (const [field, messages] of grouped) {
      const target = targetFor(field);
      if (!target) continue;
      const message = root.createElement('p');
      message.id = `publication-error-${field}`;
      message.className = 'publication-field-error';
      message.textContent = messages.join(' ');
      const invalid = target.getAttribute('aria-invalid');
      const describedBy = target.getAttribute('aria-describedby');
      target.after(message);
      target.classList.add('publication-invalid');
      target.setAttribute('aria-invalid', 'true');
      target.setAttribute('aria-describedby', [describedBy, message.id].filter(Boolean).join(' '));
      marked.push({ target, message, invalid, describedBy });
    }
  }
  function reset() { attempted = false; clearMarks(); summary.hidden = true; summary.replaceChildren(); }
  return {
    update, focus, reset,
    reveal(findings) { attempted = true; update(findings); const first = findings.find(finding => finding.level === 'error'); if (first) focus(first.field || 'tiny-editor'); },
    dispose() { reset(); summary.remove(); }
  };
}
