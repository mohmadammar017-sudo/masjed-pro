import { DependencyList, useEffect } from 'react';

export type PresenterRemoteAction =
  | 'forward'
  | 'back'
  | 'previousItem'
  | 'nextItem'
  | 'escape'
  | 'home';

const ACTION_BY_CODE: Record<string, PresenterRemoteAction> = {
  ArrowRight: 'forward',
  ArrowLeft: 'back',
  PageUp: 'previousItem',
  PageDown: 'nextItem',
  Escape: 'escape',
  F5: 'home'
};

export const PRESENTER_REMOTE_CODES = Object.keys(ACTION_BY_CODE);

export const getPresenterRemoteAction = (code: string): PresenterRemoteAction | null => ACTION_BY_CODE[code] || null;

interface UsePresenterRemoteOptions {
  enabled?: boolean;
  preventDefault?: boolean;
}

export const usePresenterRemote = (
  handler: (action: PresenterRemoteAction, event: KeyboardEvent) => void,
  deps: DependencyList,
  options?: UsePresenterRemoteOptions
) => {
  useEffect(() => {
    if (options?.enabled === false) return;

    const onKeyDown = (event: KeyboardEvent) => {
      const action = getPresenterRemoteAction(event.code);
      if (!action) return;
      if (options?.preventDefault !== false) {
        event.preventDefault();
      }
      handler(action, event);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, deps);
};

