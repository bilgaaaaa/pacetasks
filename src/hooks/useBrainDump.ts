import { useCallback, useReducer } from "react";
import * as brainDumpApi from "../lib/brainDumpApi";
import { BrainDumpApiError } from "../lib/brainDumpApi";
import { brainDumpReducer, INITIAL_BRAIN_DUMP_STATE, selectedDrafts } from "../lib/brainDumpState";
import { Task } from "../lib/types";

interface Options {
  onTasksCreated: (tasks: Task[]) => void; // lets the task list show new tasks immediately
}

// Drives the Brain Dump sheet: submit text → review the AI's proposal → commit
// the kept drafts. All state transitions live in brainDumpReducer.
export function useBrainDump({ onTasksCreated }: Options) {
  const [state, dispatch] = useReducer(brainDumpReducer, INITIAL_BRAIN_DUMP_STATE);

  const setText = useCallback((text: string) => dispatch({ type: "setText", text }), []);
  const setIncluded = useCallback(
    (index: number, included: boolean) => dispatch({ type: "setIncluded", index, included }),
    []
  );
  const setTitle = useCallback((index: number, title: string) => dispatch({ type: "setTitle", index, title }), []);

  const submit = useCallback(async () => {
    const text = state.text.trim();
    if (!text || state.phase === "interpreting") return;

    dispatch({ type: "submitStarted" });
    try {
      const proposal = await brainDumpApi.proposeBrainDump(text);
      dispatch({ type: "proposalReceived", proposal });
      if (proposal.createdTasks.length > 0) onTasksCreated(proposal.createdTasks);
    } catch (e) {
      dispatch({ type: "failed", error: toUiError(e) });
    }
  }, [state.text, state.phase, onTasksCreated]);

  const commit = useCallback(async () => {
    const drafts = selectedDrafts(state);
    if (!state.proposal || drafts.length === 0 || state.phase === "committing") return;

    dispatch({ type: "commitStarted" });
    try {
      const tasks = await brainDumpApi.commitBrainDump(state.proposal.sessionId, drafts);
      dispatch({ type: "committed", tasks });
      onTasksCreated(tasks);
    } catch (e) {
      dispatch({ type: "failed", error: toUiError(e) });
    }
  }, [state, onTasksCreated]);

  // Closing the sheet: a proposal that was reviewed but not added is discarded.
  const close = useCallback(() => {
    if (state.proposal && state.proposal.status === "proposed" && state.phase !== "done") {
      brainDumpApi.discardBrainDump(state.proposal.sessionId);
    }
    dispatch({ type: "reset" });
  }, [state.proposal, state.phase]);

  return { state, setText, setIncluded, setTitle, submit, commit, close };
}

function toUiError(error: unknown) {
  if (error instanceof BrainDumpApiError) return { message: error.message, retryable: error.retryable };
  console.warn("[useBrainDump] unexpected error", error);
  return { message: "Something went wrong — try again", retryable: true };
}
