import { useCallback, useEffect, useRef, useState } from "react";
import type { PresentationProject } from "../types/presentation";
import {
  beginProjectHistoryGroup,
  commitProjectMutation,
  createProjectHistoryState,
  finishProjectHistoryGroup,
  redoProjectMutation,
  transformProjectHistorySnapshots,
  undoProjectMutation,
  type ProjectSnapshotTransformer,
  type ProjectUpdater,
} from "../utils/projectHistory";

export type ProjectMutationOptions = {
  recordHistory?: boolean;
};

export function useProjectDocument(loadInitialProject: () => PresentationProject) {
  const [project, setProject] = useState<PresentationProject>(loadInitialProject);

  /**
   * Event and async resource callbacks need the committed document immediately,
   * before React renders the next state. The Ref and React state are therefore
   * updated together by every document mutation path.
   */
  const latestProjectRef = useRef(project);
  const historyRef = useRef(createProjectHistoryState());

  useEffect(() => {
    latestProjectRef.current = project;
  }, [project]);

  const publishProject = useCallback((nextProject: PresentationProject) => {
    latestProjectRef.current = nextProject;
    setProject(nextProject);
  }, []);

  const commitProjectChange = useCallback(
    (updater: ProjectUpdater, options: ProjectMutationOptions = {}) => {
      const result = commitProjectMutation(
        historyRef.current,
        latestProjectRef.current,
        updater,
        options,
      );

      if (!result.changed) {
        return false;
      }

      publishProject(result.project);
      return true;
    },
    [publishProject],
  );

  /**
   * Publish navigation or editor-focus changes without opening a document
   * history boundary. Existing Undo and Redo stacks intentionally stay intact.
   */
  const mutateProjectWithoutHistory = useCallback(
    (updater: ProjectUpdater) => {
      const currentProject = latestProjectRef.current;
      const nextProject = updater(currentProject);

      if (nextProject === currentProject) {
        return false;
      }

      publishProject(nextProject);
      return true;
    },
    [publishProject],
  );

  const beginHistoryGroup = useCallback(() => {
    return beginProjectHistoryGroup(
      historyRef.current,
      latestProjectRef.current,
    );
  }, []);

  const finishHistoryGroup = useCallback(() => {
    return finishProjectHistoryGroup(
      historyRef.current,
      latestProjectRef.current,
    );
  }, []);

  const undoProject = useCallback(() => {
    const projectToRestore = undoProjectMutation(
      historyRef.current,
      latestProjectRef.current,
    );

    if (!projectToRestore) {
      return undefined;
    }

    publishProject(projectToRestore);
    return projectToRestore;
  }, [publishProject]);

  const redoProject = useCallback(() => {
    const projectToRestore = redoProjectMutation(
      historyRef.current,
      latestProjectRef.current,
    );

    if (!projectToRestore) {
      return undefined;
    }

    publishProject(projectToRestore);
    return projectToRestore;
  }, [publishProject]);

  const transformProjectAndHistorySnapshots = useCallback(
    (transformer: ProjectSnapshotTransformer) => {
      const currentProject = latestProjectRef.current;
      const nextProject = transformProjectHistorySnapshots(
        historyRef.current,
        currentProject,
        transformer,
      );

      if (nextProject === currentProject) {
        return false;
      }

      publishProject(nextProject);
      return true;
    },
    [publishProject],
  );

  return {
    project,
    latestProjectRef,
    commitProjectChange,
    mutateProjectWithoutHistory,
    beginHistoryGroup,
    finishHistoryGroup,
    undoProject,
    redoProject,
    transformProjectAndHistorySnapshots,
  };
}

export type { ProjectSnapshotKind, ProjectUpdater } from "../utils/projectHistory";
