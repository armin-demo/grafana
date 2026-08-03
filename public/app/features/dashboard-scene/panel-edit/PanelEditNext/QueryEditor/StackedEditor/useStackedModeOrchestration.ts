import { useCallback, useMemo, useRef, useState } from 'react';

import { QueryEditorType } from '../../constants';
import { type StackedEditorItem, type StackedEditorState } from '../QueryEditorContext';

interface UseStackedModeOrchestrationArgs {
  /**
   * Moves the active (editor) card without touching the bulk selection. Used by `enter` to pin the
   * primary item to the top of the stack and by `syncActiveItem` to follow the scroll position \u2014
   * both must preserve any multi-select checkboxes, since the stack is a layout choice, not a mode.
   */
  activateItem: (queryRefId: string | null, transformationId: string | null) => void;
  selectedQueryRefIds: readonly string[];
  selectedTransformationIds: readonly string[];
  /**
   * Cross-mode cleanup invoked on `enter` (e.g. clear alert selection).
   * Captured via ref so callers can pass an inline function without re-creating `enter`.
   */
  onEnter?: () => void;
}

/**
 * Owns the stacked-mode state machine: the on/off boolean, the imperative scroll bridge,
 * and the `enter` / `exit` / `syncActiveItem` callbacks.
 *
 * Lives outside `QueryEditorContextWrapper` so the wrapper doesn't carry the stacked-only
 * plumbing inline. The wrapper composes this hook and exposes the returned `stackedMode`
 * on its context. Callers that need to force-exit reach for `stackedMode.exit`.
 */
export function useStackedModeOrchestration({
  activateItem,
  selectedQueryRefIds,
  selectedTransformationIds,
  onEnter,
}: UseStackedModeOrchestrationArgs): StackedEditorState {
  const [isStackedMode, setIsStackedMode] = useState(false);

  // `enter` is invoked imperatively from a button click, so reading the latest selection
  // and onEnter via refs is safe and keeps `enter` referentially stable across selections.
  const selectedQueryRefIdsRef = useRef(selectedQueryRefIds);
  selectedQueryRefIdsRef.current = selectedQueryRefIds;
  const selectedTransformationIdsRef = useRef(selectedTransformationIds);
  selectedTransformationIdsRef.current = selectedTransformationIds;
  const onEnterRef = useRef(onEnter);
  onEnterRef.current = onEnter;

  const enter = useCallback(() => {
    onEnterRef.current?.();
    // Pin the most-recently-selected card to the top of the stack. Transformations are downstream
    // of queries in the pipeline, so if both are selected the user is most likely working on the
    // transformation step. Only the active card moves; any multi-select checkboxes stay put.
    const primaryTransformationId = selectedTransformationIdsRef.current.at(-1);
    const primaryQueryRefId = selectedQueryRefIdsRef.current.at(-1);
    if (primaryTransformationId) {
      activateItem(null, primaryTransformationId);
    } else if (primaryQueryRefId) {
      activateItem(primaryQueryRefId, null);
    }
    setIsStackedMode(true);
  }, [activateItem]);

  const exit = useCallback(() => {
    setIsStackedMode(false);
  }, []);

  const syncActiveItem = useCallback(
    (item: StackedEditorItem) => {
      if (item.type === QueryEditorType.Transformation) {
        activateItem(null, item.id);
      } else {
        activateItem(item.id, null);
      }
    },
    [activateItem]
  );

  return useMemo<StackedEditorState>(
    () => ({
      enabled: isStackedMode,
      enter,
      exit,
      syncActiveItem,
    }),
    [isStackedMode, enter, exit, syncActiveItem]
  );
}
