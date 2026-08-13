


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";








ALTER SCHEMA "public" OWNER TO "postgres";


CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE OR REPLACE FUNCTION "public"."handle_new_user"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'pg_temp'
    AS $$
declare
  base      text;
  candidate text;
  i         int;
begin
  base := coalesce(
    nullif(public.normalize_username_base(new.raw_user_meta_data->>'username'), ''),
    nullif(public.normalize_username_base(split_part(new.email, '@', 1)), ''),
    'operator'
  );

  -- The app's username policy is 3-24 chars; pad anything shorter so the
  -- CHECK constraint added in Phase 5 cannot reject a signup.
  if length(base) < 3 then
    base := rpad(base, 3, '0');
  end if;

  candidate := base;

  -- Suffix on collision: name, name_2, name_3, ... Handling unique_violation
  -- rather than pre-checking makes this correct under concurrent signups.
  for i in 1..50 loop
    begin
      insert into public.operator_profile (id, username)
      values (new.id, candidate)
      on conflict (id) do nothing;
      return new;
    exception when unique_violation then
      candidate := left(base, greatest(1, 24 - length('_' || (i + 1)::text)))
                   || '_' || (i + 1)::text;
    end;
  end loop;

  -- Last resort. A uuid fragment is unique by construction, so signup can
  -- never fail on username contention.
  insert into public.operator_profile (id, username)
  values (new.id, left(base, 17) || '_' || substr(replace(new.id::text, '-', ''), 1, 6))
  on conflict (id) do nothing;

  return new;
end;
$$;


ALTER FUNCTION "public"."handle_new_user"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."normalize_username_base"("input" "text") RETURNS "text"
    LANGUAGE "sql" IMMUTABLE
    AS $$
  select left(
    trim(both '_' from regexp_replace(lower(coalesce(input, 'operator')), '[^a-z0-9_]+', '_', 'g')),
    20
  )
$$;


ALTER FUNCTION "public"."normalize_username_base"("input" "text") OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."daily_habits" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "completed_today" boolean DEFAULT false NOT NULL,
    "streak" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_habits" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."daily_logs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "date" "date" NOT NULL,
    "nn_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "habit_summary" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "total_xp_at_time" integer DEFAULT 0 NOT NULL,
    "penalty" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."daily_logs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friend_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "sender_id" "uuid" NOT NULL,
    "receiver_id" "uuid" NOT NULL,
    "status" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "responded_at" timestamp with time zone,
    CONSTRAINT "friend_requests_check" CHECK (("sender_id" <> "receiver_id")),
    CONSTRAINT "friend_requests_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'accepted'::"text", 'declined'::"text", 'canceled'::"text"])))
);


ALTER TABLE "public"."friend_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."friendships" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_low_id" "uuid" NOT NULL,
    "user_high_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "friendships_check" CHECK (("user_low_id" < "user_high_id"))
);


ALTER TABLE "public"."friendships" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."non_negotiables" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "completed_today" boolean DEFAULT false NOT NULL,
    "streak" integer DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."non_negotiables" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."objectives" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "type" "text" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text" NOT NULL,
    "progress" integer DEFAULT 0 NOT NULL,
    "status" "text" DEFAULT 'Active'::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "objectives_status_check" CHECK (("status" = ANY (ARRAY['Active'::"text", 'Completed'::"text"]))),
    CONSTRAINT "objectives_type_check" CHECK (("type" = ANY (ARRAY['north-star'::"text", 'sprint'::"text"])))
);


ALTER TABLE "public"."objectives" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."operator_profile" (
    "id" "uuid" NOT NULL,
    "xp" integer DEFAULT 0 NOT NULL,
    "streak" integer DEFAULT 0 NOT NULL,
    "last_check_in" timestamp with time zone,
    "last_habit_reset" "date",
    "initialized_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "timezone" "text" DEFAULT 'UTC'::"text" NOT NULL,
    "ghost_opt_in" boolean DEFAULT false NOT NULL,
    "ghost_opted_in_at" timestamp with time zone,
    "username" "text" NOT NULL
);


ALTER TABLE "public"."operator_profile" OWNER TO "postgres";


ALTER TABLE ONLY "public"."daily_habits"
    ADD CONSTRAINT "daily_habits_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_low_id_user_high_id_key" UNIQUE ("user_low_id", "user_high_id");



ALTER TABLE ONLY "public"."non_negotiables"
    ADD CONSTRAINT "non_negotiables_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."objectives"
    ADD CONSTRAINT "objectives_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."operator_profile"
    ADD CONSTRAINT "operator_profile_pkey" PRIMARY KEY ("id");



CREATE UNIQUE INDEX "daily_logs_user_date_idx" ON "public"."daily_logs" USING "btree" ("user_id", "date");



CREATE UNIQUE INDEX "friend_requests_pending_pair_unique" ON "public"."friend_requests" USING "btree" (LEAST("sender_id", "receiver_id"), GREATEST("sender_id", "receiver_id")) WHERE ("status" = 'pending'::"text");



CREATE INDEX "friend_requests_receiver_idx" ON "public"."friend_requests" USING "btree" ("receiver_id", "status", "created_at" DESC);



CREATE INDEX "friend_requests_sender_idx" ON "public"."friend_requests" USING "btree" ("sender_id", "status", "created_at" DESC);



CREATE INDEX "friendships_high_idx" ON "public"."friendships" USING "btree" ("user_high_id");



CREATE INDEX "friendships_low_idx" ON "public"."friendships" USING "btree" ("user_low_id");



CREATE UNIQUE INDEX "operator_profile_username_lower_unique" ON "public"."operator_profile" USING "btree" ("lower"("username")) WHERE ("username" IS NOT NULL);



ALTER TABLE ONLY "public"."daily_habits"
    ADD CONSTRAINT "daily_habits_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."daily_logs"
    ADD CONSTRAINT "daily_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_receiver_id_fkey" FOREIGN KEY ("receiver_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friend_requests"
    ADD CONSTRAINT "friend_requests_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_high_id_fkey" FOREIGN KEY ("user_high_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."friendships"
    ADD CONSTRAINT "friendships_user_low_id_fkey" FOREIGN KEY ("user_low_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."non_negotiables"
    ADD CONSTRAINT "non_negotiables_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."objectives"
    ADD CONSTRAINT "objectives_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."operator_profile"
    ADD CONSTRAINT "operator_profile_id_fkey" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Users delete own daily_habits" ON "public"."daily_habits" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own non_negotiables" ON "public"."non_negotiables" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users delete own objectives" ON "public"."objectives" FOR DELETE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own daily_habits" ON "public"."daily_habits" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own daily_logs" ON "public"."daily_logs" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own non_negotiables" ON "public"."non_negotiables" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own objectives" ON "public"."objectives" FOR INSERT WITH CHECK (("auth"."uid"() = "user_id"));



CREATE POLICY "Users insert own profile" ON "public"."operator_profile" FOR INSERT WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users read own daily_habits" ON "public"."daily_habits" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own daily_logs" ON "public"."daily_logs" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own friend requests" ON "public"."friend_requests" FOR SELECT USING ((("auth"."uid"() = "sender_id") OR ("auth"."uid"() = "receiver_id")));



CREATE POLICY "Users read own friendships" ON "public"."friendships" FOR SELECT USING ((("auth"."uid"() = "user_low_id") OR ("auth"."uid"() = "user_high_id")));



CREATE POLICY "Users read own non_negotiables" ON "public"."non_negotiables" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own objectives" ON "public"."objectives" FOR SELECT USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users read own profile" ON "public"."operator_profile" FOR SELECT USING (("auth"."uid"() = "id"));



CREATE POLICY "Users update own daily_habits" ON "public"."daily_habits" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own daily_logs" ON "public"."daily_logs" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own non_negotiables" ON "public"."non_negotiables" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own objectives" ON "public"."objectives" FOR UPDATE USING (("auth"."uid"() = "user_id"));



CREATE POLICY "Users update own profile" ON "public"."operator_profile" FOR UPDATE USING (("auth"."uid"() = "id"));



ALTER TABLE "public"."daily_habits" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."daily_logs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friend_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."friendships" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."non_negotiables" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."objectives" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."operator_profile" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";





REVOKE USAGE ON SCHEMA "public" FROM PUBLIC;
GRANT ALL ON SCHEMA "public" TO PUBLIC;
































































































































































































GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."daily_habits" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."daily_habits" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."daily_logs" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."daily_logs" TO "service_role";



GRANT SELECT ON TABLE "public"."friend_requests" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."friend_requests" TO "service_role";



GRANT SELECT ON TABLE "public"."friendships" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."friendships" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."non_negotiables" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."non_negotiables" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."objectives" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."objectives" TO "service_role";



GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."operator_profile" TO "authenticated";
GRANT SELECT,INSERT,DELETE,UPDATE ON TABLE "public"."operator_profile" TO "service_role";


































drop extension if exists "pg_net";

revoke references on table "public"."daily_habits" from "anon";

revoke trigger on table "public"."daily_habits" from "anon";

revoke truncate on table "public"."daily_habits" from "anon";

revoke references on table "public"."daily_habits" from "authenticated";

revoke trigger on table "public"."daily_habits" from "authenticated";

revoke truncate on table "public"."daily_habits" from "authenticated";

revoke references on table "public"."daily_habits" from "service_role";

revoke trigger on table "public"."daily_habits" from "service_role";

revoke truncate on table "public"."daily_habits" from "service_role";

revoke references on table "public"."daily_logs" from "anon";

revoke trigger on table "public"."daily_logs" from "anon";

revoke truncate on table "public"."daily_logs" from "anon";

revoke references on table "public"."daily_logs" from "authenticated";

revoke trigger on table "public"."daily_logs" from "authenticated";

revoke truncate on table "public"."daily_logs" from "authenticated";

revoke references on table "public"."daily_logs" from "service_role";

revoke trigger on table "public"."daily_logs" from "service_role";

revoke truncate on table "public"."daily_logs" from "service_role";

revoke references on table "public"."friend_requests" from "anon";

revoke trigger on table "public"."friend_requests" from "anon";

revoke truncate on table "public"."friend_requests" from "anon";

revoke references on table "public"."friend_requests" from "authenticated";

revoke trigger on table "public"."friend_requests" from "authenticated";

revoke truncate on table "public"."friend_requests" from "authenticated";

revoke references on table "public"."friend_requests" from "service_role";

revoke trigger on table "public"."friend_requests" from "service_role";

revoke truncate on table "public"."friend_requests" from "service_role";

revoke references on table "public"."friendships" from "anon";

revoke trigger on table "public"."friendships" from "anon";

revoke truncate on table "public"."friendships" from "anon";

revoke references on table "public"."friendships" from "authenticated";

revoke trigger on table "public"."friendships" from "authenticated";

revoke truncate on table "public"."friendships" from "authenticated";

revoke references on table "public"."friendships" from "service_role";

revoke trigger on table "public"."friendships" from "service_role";

revoke truncate on table "public"."friendships" from "service_role";

revoke references on table "public"."non_negotiables" from "anon";

revoke trigger on table "public"."non_negotiables" from "anon";

revoke truncate on table "public"."non_negotiables" from "anon";

revoke references on table "public"."non_negotiables" from "authenticated";

revoke trigger on table "public"."non_negotiables" from "authenticated";

revoke truncate on table "public"."non_negotiables" from "authenticated";

revoke references on table "public"."non_negotiables" from "service_role";

revoke trigger on table "public"."non_negotiables" from "service_role";

revoke truncate on table "public"."non_negotiables" from "service_role";

revoke references on table "public"."objectives" from "anon";

revoke trigger on table "public"."objectives" from "anon";

revoke truncate on table "public"."objectives" from "anon";

revoke references on table "public"."objectives" from "authenticated";

revoke trigger on table "public"."objectives" from "authenticated";

revoke truncate on table "public"."objectives" from "authenticated";

revoke references on table "public"."objectives" from "service_role";

revoke trigger on table "public"."objectives" from "service_role";

revoke truncate on table "public"."objectives" from "service_role";

revoke references on table "public"."operator_profile" from "anon";

revoke trigger on table "public"."operator_profile" from "anon";

revoke truncate on table "public"."operator_profile" from "anon";

revoke references on table "public"."operator_profile" from "authenticated";

revoke trigger on table "public"."operator_profile" from "authenticated";

revoke truncate on table "public"."operator_profile" from "authenticated";

revoke references on table "public"."operator_profile" from "service_role";

revoke trigger on table "public"."operator_profile" from "service_role";

revoke truncate on table "public"."operator_profile" from "service_role";

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


