/**
 * Masks email addresses in an embedded upstream screen that has no masking of its own (the
 * routing board), by rewriting its rendered text and tooltip attributes in place.
 *
 * Presentation only: React never reads these nodes back, and the data it sends to the backend
 * comes from its own state, so identifiers used for saving stay intact. Re-renders that restore
 * the raw text are caught by the observer and masked again. Turning masking off takes effect on
 * the next mount; the toggle lives on the Accounts tab, so switching tabs remounts the board.
 */

import { useEffect, type RefObject } from 'react';
import { maskEmails } from './maskEmail';

const ATTRIBUTES = ['title', 'aria-label', 'data-tip', 'placeholder'];

const maskNode = (node: Node) => {
  if (node.nodeType === Node.TEXT_NODE) {
    const text = node.nodeValue ?? '';
    const masked = maskEmails(text);
    if (masked !== text) node.nodeValue = masked;
    return;
  }
  if (!(node instanceof Element)) return;
  const elements = [node, ...Array.from(node.querySelectorAll('*'))];
  elements.forEach((element) => {
    ATTRIBUTES.forEach((name) => {
      const value = element.getAttribute(name);
      if (value === null) return;
      const masked = maskEmails(value);
      if (masked !== value) element.setAttribute(name, masked);
    });
  });
  const walker = document.createTreeWalker(node, NodeFilter.SHOW_TEXT);
  for (let text = walker.nextNode(); text; text = walker.nextNode()) maskNode(text);
};

export function useMaskedSubtree(ref: RefObject<HTMLElement | null>, enabled: boolean) {
  useEffect(() => {
    const root = ref.current;
    if (!enabled || !root) return;
    maskNode(root);
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList') mutation.addedNodes.forEach(maskNode);
        else maskNode(mutation.target);
      });
    });
    observer.observe(root, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ATTRIBUTES,
    });
    return () => observer.disconnect();
  }, [ref, enabled]);
}
