import { useCallback, useReducer, useRef } from "react";
import * as brainDumpApi from "../lib/brainDumpApi";
import { BrainDumpApiError } from "../lib/brainDumpApi";
import {
  brainDumpReducer,
  INITIAL_BRAIN_DUMP_STATE,
  selectedDrafts,
  sessionToDiscardOnClose,
} from "../lib/brainDumpState";
import { Task } from "../lib/types";

interface Options {
  onTasksCreated: (tasks: Task[]) => void; // lets the task list show new tasks immediately
}

// Drives the Brain Dump sheet: submit text → review the AI's proposal → commit
// the kept drafts. All state transitions live in brainDumpReducer.
export function useBrainDump({ onTasksCreated }: Options) {
  const [state, dispatch] = useReducer(brainDumpReducer, INITIAL_BRAIN_DUMP_STATE);
  const visitRef = useRef(0); // bumped on close, so an answer that arrives after the sheet closed never lands on the next opening

  const setText = useCallback((text: string) => dispatch({ type: "setText", text }), []);
  const setIncluded = useCallback(
    (index: number, included: boolean) => dispatch({ type: "setIncluded", index, included }),
    []
  );
  const setTitle = useCallback((index: number, title: string) => dispatch({ type: "setTitle", index, title }), []);

  const submit = useCallback(async () => {
    const text = state.text.trim();
    if (!text || state.phase === "interpreting") return;

    const visit = visitRef.current;
    dispatch({ type: "submitStarted" });
    try {
      const proposal = await brainDumpApi.proposeBrainDump(text);
      if (proposal.createdTasks.length > 0) onTasksCreated(proposal.createdTasks);
      if (visit === visitRef.current) {
        dispatch({ type: "proposalReceived", proposal });
      } else if (proposal.status === "proposed") {
        console.log("[useBrainDump] proposal arrived after the sheet closed; discarding it");
        brainDumpApi.discardBrainDump(proposal.sessionId);
      }
    } catch (e) {
      const error = toUiError(e);
      if (visit === visitRef.current) dispatch({ type: "failed", error });
    }
  }, [state.text, state.phase, onTasksCreated]);

  const commit = useCallback(async () => {
    const drafts = selectedDrafts(state);
    if (!state.proposal || drafts.length === 0 || state.phase === "committing") return;

    const visit = visitRef.current;
    dispatch({ type: "commitStarted" });
    try {
      const tasks = await brainDumpApi.commitBrainDump(state.proposal.sessionId, drafts);
      onTasksCreated(tasks); // the tasks exist even if the sheet closed meanwhile
      if (visit === visitRef.current) dispatch({ type: "committed", tasks });
    } catch (e) {
      const error = toUiError(e);
      if (visit === visitRef.current) dispatch({ type: "failed", error });
    }
  }, [state, onTasksCreated]);

  // Closing the sheet: a proposal that was reviewed but not added is discarded,
  // and requests still on their way no longer report back to this sheet.
  const close = useCallback(() => {
    const sessionId = sessionToDiscardOnClose(state);
    if (sessionId) brainDumpApi.discardBrainDump(sessionId);
    visitRef.current += 1;
    dispatch({ type: "reset" });
  }, [state]);

  return { state, setText, setIncluded, setTitle, submit, commit, close };
}

function toUiError(error: unknown) {
  if (error instanceof BrainDumpApiError) return { message: error.message, retryable: error.retryable };
  console.warn("[useBrainDump] unexpected error", error);
  return { message: "Something went wrong — try again", retryable: true };
}
