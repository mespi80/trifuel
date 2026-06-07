CREATE TYPE "public"."auth_provider" AS ENUM('email', 'google', 'apple');--> statement-breakpoint
CREATE TYPE "public"."diet_type" AS ENUM('vegan', 'vegetarian', 'omnivore');--> statement-breakpoint
CREATE TYPE "public"."discipline" AS ENUM('swim', 'bike', 'run', 'brick', 'strength', 'recovery');--> statement-breakpoint
CREATE TYPE "public"."experience_level" AS ENUM('beginner', 'intermediate', 'advanced', 'elite');--> statement-breakpoint
CREATE TYPE "public"."food_source" AS ENUM('usda', 'openfoodfacts', 'user');--> statement-breakpoint
CREATE TYPE "public"."hydration_type" AS ENUM('water', 'electrolyte', 'other');--> statement-breakpoint
CREATE TYPE "public"."intensity_zone" AS ENUM('z1', 'z2', 'z3', 'z4', 'z5', 'z6');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'es', 'pt');--> statement-breakpoint
CREATE TYPE "public"."meal_slot" AS ENUM('breakfast', 'morning_snack', 'lunch', 'afternoon_snack', 'dinner', 'pre_workout', 'intra_workout', 'post_workout');--> statement-breakpoint
CREATE TYPE "public"."measurement_source" AS ENUM('manual', 'garmin', 'wahoo', 'coros', 'scale');--> statement-breakpoint
CREATE TYPE "public"."provider" AS ENUM('garmin', 'wahoo', 'coros');--> statement-breakpoint
CREATE TYPE "public"."race_distance" AS ENUM('sprint', 'olympic', 'half_ironman', 'ironman');--> statement-breakpoint
CREATE TYPE "public"."race_priority" AS ENUM('A', 'B', 'C');--> statement-breakpoint
CREATE TYPE "public"."session_status" AS ENUM('planned', 'completed', 'missed', 'skipped');--> statement-breakpoint
CREATE TYPE "public"."sex" AS ENUM('male', 'female', 'other');--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'incomplete');--> statement-breakpoint
CREATE TYPE "public"."subscription_tier" AS ENUM('free', 'premium');--> statement-breakpoint
CREATE TYPE "public"."training_plan_status" AS ENUM('draft', 'active', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."units" AS ENUM('metric', 'imperial');--> statement-breakpoint
CREATE TYPE "public"."wearable_status" AS ENUM('active', 'expired', 'revoked', 'error');--> statement-breakpoint
CREATE TYPE "public"."zone_type" AS ENUM('hr', 'pace', 'power', 'css');--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"name" text,
	"provider" "auth_provider" DEFAULT 'email' NOT NULL,
	"provider_id" text,
	"language" "language" DEFAULT 'en' NOT NULL,
	"units" "units" DEFAULT 'metric' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "athlete_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"weight_kg" real,
	"height_cm" real,
	"birth_date" date,
	"sex" "sex",
	"diet_type" "diet_type" DEFAULT 'omnivore' NOT NULL,
	"experience_level" "experience_level" DEFAULT 'beginner' NOT NULL,
	"allergies" jsonb DEFAULT '[]'::jsonb,
	"preferred_foods" jsonb DEFAULT '[]'::jsonb,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "race_goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"distance" "race_distance" NOT NULL,
	"race_name" text NOT NULL,
	"race_date" date NOT NULL,
	"priority" "race_priority" DEFAULT 'A' NOT NULL,
	"target_times" jsonb DEFAULT '{}'::jsonb,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"race_goal_id" uuid,
	"name" text NOT NULL,
	"status" "training_plan_status" DEFAULT 'draft' NOT NULL,
	"weekly_hours_target" real,
	"phases" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"plan_id" uuid NOT NULL,
	"date" date NOT NULL,
	"discipline" "discipline" NOT NULL,
	"duration_minutes" integer NOT NULL,
	"intensity_zone" "intensity_zone",
	"intervals" jsonb DEFAULT '[]'::jsonb,
	"objective" text,
	"status" "session_status" DEFAULT 'planned' NOT NULL,
	"actual_data" jsonb,
	"rpe" smallint,
	"notes" text,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "training_zones" (
	"user_id" uuid NOT NULL,
	"discipline" "discipline" NOT NULL,
	"zone_type" "zone_type" NOT NULL,
	"zones" jsonb NOT NULL,
	"last_updated" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name_en" text NOT NULL,
	"name_es" text,
	"brand" text,
	"barcode" text,
	"macros" jsonb NOT NULL,
	"micros" jsonb DEFAULT '{}'::jsonb,
	"serving_size" real NOT NULL,
	"serving_unit" text NOT NULL,
	"is_vegan" boolean DEFAULT false NOT NULL,
	"is_vegetarian" boolean DEFAULT false NOT NULL,
	"is_gluten_free" boolean DEFAULT false NOT NULL,
	"source" "food_source" DEFAULT 'user' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "food_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"food_item_id" uuid NOT NULL,
	"date" date NOT NULL,
	"meal_slot" "meal_slot" NOT NULL,
	"quantity" real NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "hydration_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"amount_ml" integer NOT NULL,
	"type" "hydration_type" DEFAULT 'water' NOT NULL,
	"logged_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "meal_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" text NOT NULL,
	"items" jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "nutrition_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"cho_g" real NOT NULL,
	"protein_g" real NOT NULL,
	"fat_g" real NOT NULL,
	"calories" integer NOT NULL,
	"hydration_ml" integer NOT NULL,
	"micros" jsonb DEFAULT '{}'::jsonb,
	"generated_from_session_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "body_measurements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weight_kg" real,
	"body_fat_pct" real,
	"muscle_mass_kg" real,
	"source" "measurement_source" DEFAULT 'manual' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "garmin_hrv_readings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"date" date NOT NULL,
	"weekly_avg_ms" real,
	"last_night_high_ms" real,
	"last_night_low_ms" real,
	"status" text,
	"baseline_ms" real,
	"avg_stress_level" smallint,
	"raw_payload" jsonb,
	"pulled_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wearable_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"provider" "provider" NOT NULL,
	"provider_user_id" text,
	"access_token_encrypted" text NOT NULL,
	"refresh_token_encrypted" text,
	"token_expires_at" timestamp,
	"last_sync_at" timestamp,
	"status" "wearable_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "subscriptions" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"tier" "subscription_tier" DEFAULT 'free' NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"period_end" timestamp,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "athlete_profiles" ADD CONSTRAINT "athlete_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "race_goals" ADD CONSTRAINT "race_goals_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_plans" ADD CONSTRAINT "training_plans_race_goal_id_race_goals_id_fk" FOREIGN KEY ("race_goal_id") REFERENCES "public"."race_goals"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_sessions" ADD CONSTRAINT "training_sessions_plan_id_training_plans_id_fk" FOREIGN KEY ("plan_id") REFERENCES "public"."training_plans"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "training_zones" ADD CONSTRAINT "training_zones_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "food_logs" ADD CONSTRAINT "food_logs_food_item_id_food_items_id_fk" FOREIGN KEY ("food_item_id") REFERENCES "public"."food_items"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "hydration_logs" ADD CONSTRAINT "hydration_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "meal_templates" ADD CONSTRAINT "meal_templates_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "nutrition_targets" ADD CONSTRAINT "nutrition_targets_generated_from_session_id_training_sessions_id_fk" FOREIGN KEY ("generated_from_session_id") REFERENCES "public"."training_sessions"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "body_measurements" ADD CONSTRAINT "body_measurements_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "garmin_hrv_readings" ADD CONSTRAINT "garmin_hrv_readings_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wearable_connections" ADD CONSTRAINT "wearable_connections_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "subscriptions" ADD CONSTRAINT "subscriptions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");--> statement-breakpoint
CREATE INDEX "users_provider_provider_id_idx" ON "users" USING btree ("provider","provider_id");--> statement-breakpoint
CREATE INDEX "race_goals_user_id_idx" ON "race_goals" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "race_goals_race_date_idx" ON "race_goals" USING btree ("race_date");--> statement-breakpoint
CREATE INDEX "training_plans_user_id_idx" ON "training_plans" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "training_plans_race_goal_id_idx" ON "training_plans" USING btree ("race_goal_id");--> statement-breakpoint
CREATE INDEX "training_plans_status_idx" ON "training_plans" USING btree ("status");--> statement-breakpoint
CREATE INDEX "training_sessions_plan_id_idx" ON "training_sessions" USING btree ("plan_id");--> statement-breakpoint
CREATE INDEX "training_sessions_date_idx" ON "training_sessions" USING btree ("date");--> statement-breakpoint
CREATE INDEX "training_sessions_discipline_idx" ON "training_sessions" USING btree ("discipline");--> statement-breakpoint
CREATE INDEX "training_sessions_status_idx" ON "training_sessions" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "training_zones_user_discipline_type_idx" ON "training_zones" USING btree ("user_id","discipline","zone_type");--> statement-breakpoint
CREATE INDEX "training_zones_user_id_idx" ON "training_zones" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "food_items_name_en_idx" ON "food_items" USING btree ("name_en");--> statement-breakpoint
CREATE INDEX "food_items_barcode_idx" ON "food_items" USING btree ("barcode");--> statement-breakpoint
CREATE INDEX "food_items_is_vegan_idx" ON "food_items" USING btree ("is_vegan");--> statement-breakpoint
CREATE INDEX "food_items_source_idx" ON "food_items" USING btree ("source");--> statement-breakpoint
CREATE INDEX "food_logs_user_id_date_idx" ON "food_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "food_logs_user_id_idx" ON "food_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "food_logs_date_idx" ON "food_logs" USING btree ("date");--> statement-breakpoint
CREATE INDEX "hydration_logs_user_id_date_idx" ON "hydration_logs" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "hydration_logs_user_id_idx" ON "hydration_logs" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "meal_templates_user_id_idx" ON "meal_templates" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "nutrition_targets_user_date_idx" ON "nutrition_targets" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "nutrition_targets_user_id_idx" ON "nutrition_targets" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "body_measurements_user_id_date_idx" ON "body_measurements" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "body_measurements_user_id_idx" ON "body_measurements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "garmin_hrv_readings_user_date_idx" ON "garmin_hrv_readings" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "garmin_hrv_readings_user_id_idx" ON "garmin_hrv_readings" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "wearable_connections_user_provider_idx" ON "wearable_connections" USING btree ("user_id","provider");--> statement-breakpoint
CREATE INDEX "wearable_connections_user_id_idx" ON "wearable_connections" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wearable_connections_status_idx" ON "wearable_connections" USING btree ("status");--> statement-breakpoint
CREATE INDEX "subscriptions_stripe_customer_id_idx" ON "subscriptions" USING btree ("stripe_customer_id");--> statement-breakpoint
CREATE INDEX "subscriptions_status_idx" ON "subscriptions" USING btree ("status");