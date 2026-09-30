import type { Kit } from "@aipk/core";

export type {
  Kit,
  Requirement,
  Question,
  Flashcard,
  ScheduleDay,
  ItemMeta,
  QuestionCategory,
  RequirementKind,
  RequirementPriority,
  ItemSource,
} from "@aipk/core";

export type PipelineStatus = "idle" | "running" | "completed" | "failed";

export interface KitDocument {
  _id: string;
  company_url: string;
  days_requested: number;
  pipeline_status: PipelineStatus;
  current_step?: string;
  pipeline_error?: { code: string; message: string } | null;
  kit: Kit | null;
  createdAt: string;
  updatedAt: string;
}

export interface KitListItem {
  _id: string;
  company_url: string;
  days_requested: number;
  pipeline_status: PipelineStatus;
  current_step?: string;
  createdAt: string;
  kit?: { source?: { company?: string; role?: string } };
}
