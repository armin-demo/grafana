import { useEffect } from 'react';

import { type GrafanaLocation } from '@grafana/data';
import { locationService } from '@grafana/runtime';

interface PromptProps {
  when?: boolean;
  message: string | ((location: GrafanaLocation) => string | boolean);
}

/**
 * Blocks in-app navigations while `when` is true.
 * Uses locationService.blockNavigation (history.block today; React Router blockers later).
 */
export const Prompt = ({ message, when = true }: PromptProps) => {
  useEffect(() => {
    if (!when) {
      return undefined;
    }

    const unblock = locationService.blockNavigation(message);
    return () => {
      unblock();
    };
  }, [when, message]);

  return null;
};
