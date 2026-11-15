


import { useCallback, useEffect, useRef, useState } from 'react';
import { prefersReducedMotion } from '@/hooks/motion';
import type { VisualConfigValues } from '@/types/visualConfig';
import { FIELD_HIGHLIGHT_CLASS } from '../components/fields/FieldPrimitives';
import type { ConfigTabId } from '../constants';
import {
  configFieldDomId,
  type ConfigFieldSearchEntry,
  type VisualSectionId,
} from '../searchIndex';

export type UseFieldJumpArgs = {
  values: VisualConfigValues;

  setActiveSection: (id: ConfigTabId) => void;
};

export function useFieldJump({ values, setActiveSection }: UseFieldJumpArgs) {


  const [jumpRequest, setJumpRequest] = useState<{
    fieldId: string;
    sectionId: VisualSectionId;
  } | null>(null);
  const handledJumpRef = useRef<{ fieldId: string; sectionId: VisualSectionId } | null>(null);
  const highlightTimerRef = useRef<number | null>(null);
  const highlightedElRef = useRef<HTMLElement | null>(null);

  const jumpToField = useCallback(
    (entry: ConfigFieldSearchEntry) => {

      setActiveSection(entry.sectionId);
      setJumpRequest({ fieldId: entry.fieldId, sectionId: entry.sectionId });
    },
    [setActiveSection]
  );



  useEffect(() => {
    if (!jumpRequest || handledJumpRef.current === jumpRequest) return;
    handledJumpRef.current = jumpRequest;
    const { fieldId } = jumpRequest;

    const targetFieldId =
      (fieldId === 'tlsCert' || fieldId === 'tlsKey') && !values.tlsEnable ? 'tlsEnable' : fieldId;

    const attempt = (retriesLeft: number) => {
      const el = document.getElementById(configFieldDomId(targetFieldId));
      if (!el) {

        if (retriesLeft > 0) requestAnimationFrame(() => attempt(retriesLeft - 1));
        return;
      }




      const details = el.closest('details') ?? el.querySelector('details');
      if (details && !details.open) details.open = true;


      if (highlightTimerRef.current !== null) {
        clearTimeout(highlightTimerRef.current);
        highlightedElRef.current?.classList.remove(FIELD_HIGHLIGHT_CLASS);
      }

      el.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'center',
        inline: 'nearest',
      });
      el.classList.add(FIELD_HIGHLIGHT_CLASS);
      highlightedElRef.current = el;
      highlightTimerRef.current = window.setTimeout(() => {
        el.classList.remove(FIELD_HIGHLIGHT_CLASS);
        highlightTimerRef.current = null;
        highlightedElRef.current = null;
      }, 1800);
    };

    requestAnimationFrame(() => attempt(1));
  }, [jumpRequest, values.tlsEnable]);


  useEffect(
    () => () => {
      if (highlightTimerRef.current !== null) clearTimeout(highlightTimerRef.current);
    },
    []
  );

  return { jumpToField };
}
