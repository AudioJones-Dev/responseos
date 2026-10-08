import Link from "next/link";
import {
  ContactEmail,
  LegalIntro,
  LegalList,
  LegalPage,
  LegalSection,
} from "../_components/Legal";

export const metadata = {
  title: "Privacy policy",
  description:
    "What ResponseOS collects, why, who it's shared with, how long it's kept, and how to ask us about it.",
};

const LAST_UPDATED = "October 8, 2026";

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy" lastUpdated={LAST_UPDATED}>
      <LegalIntro>
        <p>
          This policy explains what information ResponseOS collects, why, who
          it&apos;s shared with, how long it&apos;s kept, and how to reach us
          about it. ResponseOS is built and operated by AJ Digital LLC, a
          Florida limited liability company (&ldquo;we&rdquo; or
          &ldquo;us&rdquo;).
        </p>
        <p>
          ResponseOS is in active development, so this policy describes what
          the current build actually does. Several of the features below are
          switched off unless we&apos;re running a specific demo or
          assessment; where that&apos;s the case, we say so.
        </p>
      </LegalIntro>

      <LegalSection title="Browsing this site">
        <LegalList
          items={[
            "We don't use analytics, advertising cookies, tracking pixels, or third-party scripts, and our fonts are served from our own site.",
            "Our hosting provider, Vercel, keeps standard server logs of each request, such as your IP address, browser type, and the page address you asked for, so the site can run and be protected from abuse.",
            "The receptionist demo puts your question in the page address. We don't store the question, but it shows up in your browser history and in those server logs, so don't type anything private into it.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Readiness assessment requests">
        <p>
          When the request form on the{" "}
          <Link href="/audit" className="text-ink underline underline-offset-2">
            assessment page
          </Link>{" "}
          is accepting submissions, it collects your name, email, and business
          name, and, if you choose to give them, your phone number, industry,
          monthly missed calls, average job value, and anything else you write
          in the notes.
        </p>
        <LegalList
          items={[
            "We use it to review your request and follow up about the assessment.",
            "Only AJ Digital staff with operator access can read the full submission.",
            "Each submission is marked to expire 90 days after you send it. After that, a purge that we run and review deletes what you sent, keeping only a reference number. The purge isn't on a schedule, so deletion can come some time after the 90 days. If we go ahead with an assessment, we keep your request for as long as we're working on it together.",
            "You can ask us to delete your request at any time.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Demo phone calls">
        <p>
          When we run a supervised phone demo, calls to the demo number are
          answered by an AI assistant running on our telephony provider,
          Telnyx. For each call we store your phone number, the transcript and
          a summary of the call, the details you give during it, and your
          email address if it&apos;s verified on the call.
        </p>
        <LegalList
          items={[
            "Calls are transcribed, not recorded.",
            "Please use fictional details on demo calls. They aren't set up to handle anything sensitive.",
            "Personalized demo calls, which are set up for one specific business, are marked to expire after 30 days, and calls to our general demo number after 90 days. After that, the same purge deletes the call content: your phone number, the transcript and summary, and the details you gave. A record that the call happened, with its time and length, stays. You can ask us to delete a call sooner.",
            "For calls to our general demo number, we may copy your phone number, name, and verified email, plus a call summary and suggested next step, into our CRM, HubSpot, so we can follow up. Before the summary and next step are copied, an automatic filter removes the email addresses and phone numbers it recognizes, such as US numbers and numbers written with a country code; it may miss unusual formats. The purge doesn't delete this copy in HubSpot; ask us and we'll delete it there. Personalized demo calls are never sent to a CRM.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Accounts">
        <p>
          If we give you a login to the operator console or client dashboard,
          sign-in is handled by Clerk. Clerk shares your email address, name,
          and organization name with us, and sets the cookies it needs to keep
          you signed in. We also keep each account update Clerk sends us, as
          received, for 30 days; after that, the same purge deletes the stored
          copy. If your login is removed, we keep your name and email on the
          records you created so their history stays accurate. You can ask us
          to erase all of it, including those stored updates.
        </p>
      </LegalSection>

      <LegalSection title="How we use information">
        <LegalList
          items={[
            "To respond to your requests and run demos and assessments.",
            "To operate accounts and keep the service secure.",
            "To meet our legal obligations.",
            "We don't sell your information or share it for advertising.",
            "Apart from Telnyx, which runs the AI assistant on demo calls, the current build doesn't send your information to any AI model provider.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>
          Only the service providers named above, which process information
          on our behalf: Vercel (hosting), our database host, Telnyx (demo
          calls), Clerk (sign-in), and HubSpot (follow-up on general demo
          calls). We&apos;ll also disclose information if the law requires it,
          or to a buyer or successor if AJ Digital or ResponseOS is sold or
          merged. We don&apos;t share it with anyone else.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          Email <ContactEmail /> to ask what we hold about you, to correct it, or to
          delete it. There&apos;s no self-service tool for this yet, so we
          handle each request by hand and reply within 30 days. We may need to
          confirm the request comes from you. Depending on where you live, you
          may have additional rights under local law, and we&apos;ll honor
          them where they apply.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Every account&apos;s data is kept separate from every other
          account&apos;s, and incoming call events are signature-verified
          before they change anything. The{" "}
          <Link href="/trust" className="text-ink underline underline-offset-2">
            trust page
          </Link>{" "}
          lists each control and whether it&apos;s built, partial, or planned.
          No system is perfectly secure, and we don&apos;t claim ours is.
        </p>
      </LegalSection>

      <LegalSection title="Sensitive information and children">
        <p>
          Please don&apos;t send health, financial account, or other
          sensitive information through the assessment form or on a demo call.
          ResponseOS is not HIPAA-certified or HIPAA-compliant. This site
          isn&apos;t directed at children under 13, and we don&apos;t knowingly
          collect their information; if you believe we have, email us and
          we&apos;ll delete it.
        </p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          When our practices change, we&apos;ll update this page and the date
          at the top.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          AJ Digital LLC — <ContactEmail />
        </p>
      </LegalSection>
    </LegalPage>
  );
}
