import type { Metadata } from "next";
import LegalPage, { Section } from "@/components/LegalPage";
import { LEGAL_CONTACT_EMAIL, LEGAL_ENTITY, LEGAL_UPDATED } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Terms of Service — EliteOS",
  description: "The terms you agree to by using EliteOS.",
};

export default function Terms() {
  return (
    <LegalPage title="Terms of Service" updated={LEGAL_UPDATED}>
      <p>
        By creating an EliteOS account you agree to these terms. EliteOS is
        operated by {LEGAL_ENTITY}.
      </p>

      <Section heading="Your account">
        <p>
          You need a valid email address and a username to register. You are
          responsible for keeping your password to yourself, and for what
          happens under your account. Tell us if you think someone else has
          access to it.
        </p>
        <p>
          One account per person. Usernames belonging to unconfirmed signups are
          released after seven days.
        </p>
      </Section>

      <Section heading="Acceptable use">
        <p>You agree not to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Attempt to alter your XP, streak, score or leaderboard position by
            any means other than using the app as intended.
          </li>
          <li>
            Access, or try to access, another operator&apos;s data — including
            adding people as friends without their acceptance.
          </li>
          <li>
            Register accounts automatically, or send automated traffic to the
            service.
          </li>
          <li>
            Use the service to harass anyone, or to store unlawful content.
          </li>
        </ul>
        <p>
          Accounts that do these things may be suspended or removed without
          notice.
        </p>
      </Section>

      <Section heading="What EliteOS is not">
        <p>
          EliteOS is a habit and goal tracker. It is not medical, psychological,
          financial or professional advice, and nothing in it should be treated
          as such.
        </p>
      </Section>

      <Section heading="Availability and data">
        <p>
          The service is provided as-is, with no guarantee of uptime. Daily logs
          are deleted after roughly 30 days by design, so EliteOS is not a
          long-term archive — export anything you want to keep.
        </p>
        <p>
          To the extent the law allows, {LEGAL_ENTITY} is not liable for lost
          data, lost streaks, or any indirect loss arising from using the
          service.
        </p>
      </Section>

      <Section heading="Ending your account">
        <p>
          You can delete your account at any time from the Profile tab. That
          removes your data permanently and immediately. We may close accounts
          that break these terms.
        </p>
      </Section>

      <Section heading="Changes">
        <p>
          These terms may change. Material changes will be reflected in the date
          at the top of this page. Continuing to use EliteOS after a change
          means you accept it.
        </p>
        <p>
          Questions:{" "}
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
