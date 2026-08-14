import type { Metadata } from "next";
import LegalPage, { Section } from "@/components/LegalPage";
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Privacy Policy — EliteOS",
  description: "What EliteOS collects, why, and how to get rid of it.",
};

export default function PrivacyPolicy() {
  return (
    <LegalPage title="Privacy Policy" updated={LEGAL_UPDATED}>
      <p>
        EliteOS is operated by {LEGAL_ENTITY}. This policy describes what the
        service stores about you and what you can do about it. It is written to
        be read, not to be long.
      </p>

      <Section heading="What is collected">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Your email address and password.</strong> Handled by
            Supabase Auth. Passwords are stored hashed; nobody operating EliteOS
            can read them.
          </li>
          <li>
            <strong>Your username</strong>, which is visible to people you are
            friends with in the Arena.
          </li>
          <li>
            <strong>What you track</strong> — objectives, daily habits and
            non-negotiables, including their titles and descriptions.
          </li>
          <li>
            <strong>Your activity</strong> — XP, streaks, and a daily summary of
            what you completed.
          </li>
          <li>
            <strong>Your friendships</strong> and the friend requests behind
            them.
          </li>
          <li>
            <strong>Your timezone</strong>, so your day resets at your midnight
            rather than someone else&apos;s.
          </li>
        </ul>
        <p>
          There is no advertising, no analytics profile, and no third-party
          tracker on this site.
        </p>
      </Section>

      <Section heading="What other people can see">
        <p>
          Only operators you have accepted as friends can see your username, XP,
          streak and consistency score on the Arena leaderboard. The titles of
          your objectives, habits and non-negotiables are never shown to anyone
          else.
        </p>
      </Section>

      <Section heading="How long it is kept">
        <p>
          Daily logs are deleted automatically after roughly 30 days. Everything
          else is kept until you delete your account.
        </p>
      </Section>

      <Section heading="Your rights">
        <p>
          From the Profile tab you can <strong>export</strong> everything held
          about you as a JSON file, and <strong>delete</strong> your account.
          Deletion is immediate and permanent: it removes your login and every
          objective, habit, non-negotiable, log, streak and friendship attached
          to it. There is no recovery afterwards.
        </p>
        <p>
          If you are in the UK or EU, these are your GDPR rights of access,
          portability and erasure. You can also contact{" "}
          <a
            className="text-violet hover:underline underline-offset-2"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>{" "}
          to exercise them.
        </p>
      </Section>

      <Section heading="Who else processes your data">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <strong>Supabase</strong> — database and authentication.
          </li>
          <li>
            <strong>Vercel</strong> — hosting and request logs.
          </li>
          <li>
            <strong>Resend</strong> — sends confirmation and password-reset
            email.
          </li>
          <li>
            <strong>Upstash</strong> — rate limiting; stores a counter keyed to
            your account id, and no content.
          </li>
          <li>
            <strong>Sentry</strong> — error reports when something breaks.
          </li>
        </ul>
      </Section>

      <Section heading="Contact">
        <p>
          Questions about this policy:{" "}
          <a
            className="text-violet hover:underline underline-offset-2"
            href={`mailto:${LEGAL_CONTACT_EMAIL}`}
          >
            {LEGAL_CONTACT_EMAIL}
          </a>
          .
        </p>
      </Section>
    </LegalPage>
  );
}
