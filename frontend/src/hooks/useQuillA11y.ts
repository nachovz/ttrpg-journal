import { useEffect, type DependencyList } from 'react';

export function useQuillA11y(deps: DependencyList = []) {
  useEffect(() => {
    function applyQuillA11yLabels() {
      const buttonLabels: Record<string, string> = {
        'ql-bold': 'Bold',
        'ql-italic': 'Italic',
        'ql-underline': 'Underline',
        'ql-link': 'Insert link',
        'ql-clean': 'Clear formatting',
      };

      const listLabels: Record<string, string> = {
        ordered: 'Ordered list',
        bullet: 'Bullet list',
      };

      document.querySelectorAll('.ql-toolbar').forEach((toolbar) => {
        toolbar.querySelectorAll('button').forEach((button) => {
          let label = '';

          for (const [className, value] of Object.entries(buttonLabels)) {
            if (button.classList.contains(className)) {
              label = value;
              break;
            }
          }

          if (!label && button.classList.contains('ql-list')) {
            const listType = (button as HTMLButtonElement).value;
            label = listLabels[listType] || 'List style';
          }
          if (!label) {
            label = 'Editor control';
          }

          button.setAttribute('aria-label', label);
          button.setAttribute('title', label);
        });

        toolbar.querySelectorAll('.ql-picker-label').forEach((pickerLabel) => {
          pickerLabel.setAttribute('aria-label', 'Text style');
          pickerLabel.setAttribute('title', 'Text style');
        });
      });
    }

    const rafId = window.requestAnimationFrame(() => applyQuillA11yLabels());

    const observers: MutationObserver[] = [];
    document.querySelectorAll('.ql-toolbar').forEach((toolbar) => {
      const observer = new MutationObserver(() => applyQuillA11yLabels());
      observer.observe(toolbar, { childList: true, subtree: true });
      observers.push(observer);
    });

    return () => {
      window.cancelAnimationFrame(rafId);
      observers.forEach((observer) => observer.disconnect());
    };
  }, deps);
}
