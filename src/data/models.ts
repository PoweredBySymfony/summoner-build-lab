// Future-ready data models for database integration

export interface User {
  id: string;
  username: string;
  riot_game_name?: string;
  riot_tag_line?: string;
  puuid?: string;
  level: number;
  xp: number;
  streak: number;
  preferred_roles: string[];
  target_skills: string[];
  language: "fr" | "en";
  created_at: string;
}

export interface TrainingModule {
  id: string;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  duration_minutes: number;
  theme: string;
  patch_version: string;
  scenario_count: number;
  order: number;
}

export interface Scenario {
  id: string;
  module_id: string;
  question_fr: string;
  question_en: string;
  context_fr: string;
  context_en: string;
  champion_id: string;
  gold: number;
  game_time: string;
  objective: string;
  allies: string[];
  enemies: string[];
  current_build: string[];
  difficulty: "beginner" | "intermediate" | "advanced";
  patch_version: string;
}

export interface ScenarioOption {
  id: string;
  scenario_id: string;
  item_id: string;
  is_correct: boolean;
  is_viable_alternative: boolean;
  explanation_fr: string;
  explanation_en: string;
  order: number;
}

export interface Session {
  id: string;
  user_id: string;
  module_id: string;
  started_at: string;
  completed_at?: string;
  score: number;
  total_questions: number;
  xp_earned: number;
}

export interface SessionAnswer {
  id: string;
  session_id: string;
  scenario_id: string;
  selected_option_id: string;
  is_correct: boolean;
  time_taken_seconds: number;
  answered_at: string;
}

export interface MatchImport {
  id: string;
  user_id: string;
  riot_match_id: string;
  champion_id: string;
  game_duration: number;
  result: "win" | "loss";
  items_purchased: string[];
  purchase_timestamps: number[];
  imported_at: string;
}

export interface PersonalizedScenario {
  id: string;
  user_id: string;
  source_match_id: string;
  champion_id: string;
  timestamp_in_game: number;
  player_actual_item_choice: string;
  recommended_options: string[];
  explanation_fr: string;
  explanation_en: string;
  difficulty: "beginner" | "intermediate" | "advanced";
  patch_version: string;
}

export interface Achievement {
  id: string;
  key: string;
  title_fr: string;
  title_en: string;
  description_fr: string;
  description_en: string;
  icon: string;
  condition_type: string;
  condition_value: number;
}
