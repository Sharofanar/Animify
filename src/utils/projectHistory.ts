import type { PresentationProject } from "../types/presentation";

export const MAX_PROJECT_HISTORY_LENGTH = 60;

export type ProjectUpdater = (
  currentProject: PresentationProject,
) => PresentationProject;

export type ProjectSnapshotKind =
  | "current"
  | "undo"
  | "redo"
  | "history-group";

export type ProjectSnapshotTransformer = (
  project: PresentationProject,
  kind: ProjectSnapshotKind,
) => PresentationProject;

export type ProjectHistoryState = {
  undoStack: PresentationProject[];
  redoStack: PresentationProject[];
  historyGroupSnapshot: PresentationProject | null;
  historyGroupChanged: boolean;
};

export function cloneProjectSnapshot(project: PresentationProject) {
  return JSON.parse(JSON.stringify(project)) as PresentationProject;
}

export function createProjectHistoryState(): ProjectHistoryState {
  return {
    undoStack: [],
    redoStack: [],
    historyGroupSnapshot: null,
    historyGroupChanged: false,
  };
}

function pushUndoSnapshot(
  history: ProjectHistoryState,
  snapshot: PresentationProject,
) {
  history.undoStack = [
    ...history.undoStack,
    cloneProjectSnapshot(snapshot),
  ].slice(-MAX_PROJECT_HISTORY_LENGTH);
  history.redoStack = [];
}

export function commitProjectMutation(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
  updater: ProjectUpdater,
  options: { recordHistory?: boolean } = {},
) {
  const nextProject = updater(currentProject);

  /**
   * Project updaters preserve reference identity for no-ops. This avoids an
   * expensive document-wide comparison and keeps History and React untouched.
   */
  if (nextProject === currentProject) {
    return {
      changed: false,
      project: currentProject,
    };
  }

  if (options.recordHistory === false && history.historyGroupSnapshot) {
    /**
     * A continuous edit owns one snapshot captured at group start. Every later
     * pointer/slider frame only marks that transaction as changed.
     */
    history.historyGroupChanged = true;
  } else {
    pushUndoSnapshot(history, currentProject);
  }

  return {
    changed: true,
    project: nextProject,
  };
}

export function beginProjectHistoryGroup(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
) {
  if (history.historyGroupSnapshot) {
    return false;
  }

  history.historyGroupSnapshot = cloneProjectSnapshot(currentProject);
  history.historyGroupChanged = false;
  return true;
}

function isHistoryBookkeepingField(
  path: readonly (string | number)[],
  key: string,
) {
  if (path.length === 0 && key === "updatedAt") {
    return true;
  }

  /**
   * AnimationScene.revision only invalidates compiled animation caches. The
   * Tracks, Keyframes, Sequences, and other Scene fields remain authoritative
   * for whether the user's animation document actually changed.
   */
  return (
    key === "revision" &&
    path.length === 3 &&
    path[0] === "slides" &&
    typeof path[1] === "number" &&
    path[2] === "animationScene"
  );
}

function canonicalizeProjectHistoryValue(
  value: unknown,
  path: readonly (string | number)[] = [],
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      canonicalizeProjectHistoryValue(item, [...path, index]),
    );
  }

  if (!value || typeof value !== "object") {
    return value;
  }

  const record = value as Record<string, unknown>;

  return Object.fromEntries(
    Object.keys(record)
      .sort()
      .filter((key) => !isHistoryBookkeepingField(path, key))
      .map((key) => [
        key,
        canonicalizeProjectHistoryValue(record[key], [...path, key]),
      ]),
  );
}

/**
 * Compare complete user document content at one transaction boundary.
 *
 * Project.updatedAt and AnimationScene.revision are bookkeeping metadata, so
 * they cannot turn a drag that returns to its starting value into an Undo step.
 * Object keys are canonicalized while array order remains significant.
 */
export function areProjectSnapshotsEquivalentForHistory(
  left: PresentationProject,
  right: PresentationProject,
) {
  if (left === right) {
    return true;
  }

  return (
    JSON.stringify(canonicalizeProjectHistoryValue(left)) ===
    JSON.stringify(canonicalizeProjectHistoryValue(right))
  );
}

export function finishProjectHistoryGroup(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
) {
  const snapshot = history.historyGroupSnapshot;

  /**
   * Continuous frames only mark the transaction as potentially changed. The
   * O(project size) equivalence check happens once, when the group finishes, so
   * pointermove and rAF mutation paths stay free of whole-document comparisons.
   */
  if (
    snapshot &&
    history.historyGroupChanged &&
    !areProjectSnapshotsEquivalentForHistory(snapshot, currentProject)
  ) {
    pushUndoSnapshot(history, snapshot);
  }

  history.historyGroupSnapshot = null;
  history.historyGroupChanged = false;
  return Boolean(snapshot);
}

export function undoProjectMutation(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
) {
  const previousProject = history.undoStack.at(-1);

  if (!previousProject) {
    return undefined;
  }

  history.undoStack = history.undoStack.slice(0, -1);
  history.redoStack = [
    ...history.redoStack,
    cloneProjectSnapshot(currentProject),
  ].slice(-MAX_PROJECT_HISTORY_LENGTH);

  return cloneProjectSnapshot(previousProject);
}

export function redoProjectMutation(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
) {
  const nextProject = history.redoStack.at(-1);

  if (!nextProject) {
    return undefined;
  }

  history.redoStack = history.redoStack.slice(0, -1);
  history.undoStack = [
    ...history.undoStack,
    cloneProjectSnapshot(currentProject),
  ].slice(-MAX_PROJECT_HISTORY_LENGTH);

  return cloneProjectSnapshot(nextProject);
}

/**
 * Keep persistence-only metadata transformations consistent across every
 * snapshot that can later become current through Undo, Redo, or group finish.
 * Blob and Object URL ownership deliberately remains outside this data layer.
 */
export function transformProjectHistorySnapshots(
  history: ProjectHistoryState,
  currentProject: PresentationProject,
  transformer: ProjectSnapshotTransformer,
) {
  history.undoStack = history.undoStack.map((snapshot) =>
    transformer(snapshot, "undo"),
  );
  history.redoStack = history.redoStack.map((snapshot) =>
    transformer(snapshot, "redo"),
  );

  if (history.historyGroupSnapshot) {
    history.historyGroupSnapshot = transformer(
      history.historyGroupSnapshot,
      "history-group",
    );
  }

  return transformer(currentProject, "current");
}
