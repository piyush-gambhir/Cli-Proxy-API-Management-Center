/**
 * Fork only (see FORK.md): the fork runs i18next 27 while upstream is on 26. i18next 27 types
 * every `t()` call with variables as needing its options (`strictInterpolationChecks`), which
 * fails upstream code that passes options through a wrapper. This keeps the v26 typing, as the
 * i18next 27 migration guide describes, so upstream files stay unchanged. Remove it when
 * upstream moves to i18next 27.
 */

import 'i18next';

declare module 'i18next' {
  interface CustomTypeOptions {
    strictInterpolationChecks: false;
  }
}
