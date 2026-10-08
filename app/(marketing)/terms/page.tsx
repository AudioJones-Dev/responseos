import Link from "next/link";
import {
  ContactEmail,
  LegalIntro,
  LegalList,
  LegalPage,
  LegalSection,
} from "../_components/Legal";

export const metadata = {
  title: "Terms of service",
  description:
    "The terms for using the ResponseOS website and its demos, and how they relate to a paid engagement.",
};

const LAST_UPDATED = "October 8, 2026";

const linkCls = "text-ink underline underline-offset-2";

export default function TermsPage() {
  return (
    <LegalPage title="Terms of service" lastUpdated={LAST_UPDATED}>
      <LegalIntro>
        <p>
          These terms cover your use of this website and the demos on it. The
          site is run by AJ Digital LLC, a Florida limited liability company
          (&ldquo;we&rdquo; or &ldquo;us&rdquo;), which builds ResponseOS. By
          using the site, you agree to these terms. If you don&apos;t agree,
          please don&apos;t use it.
        </p>
        <p>
          A paid assessment or implementation is covered by a separate written
          agreement that we both sign. If that agreement and these terms
          disagree, the agreement wins.
        </p>
      </LegalIntro>

      <LegalSection title="What this site is">
        <LegalList
          items={[
            "ResponseOS is in active development. The site describes some features that are built and some that are planned. Anything described as planned, or as something ResponseOS is designed to do, isn't a promise that it exists or will ship.",
            "The demos use simulated or supervised test providers. Most run on fictional records; the receptionist demo answers from approved facts about its owner. They show how ResponseOS is meant to work, not results you should expect.",
            "Figures on the site, such as missed-demand estimates, revenue ranges, and example scores, are illustrations. An estimate isn't a guarantee of revenue you'll recover.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Assessments and paid work">
        <p>
          Sending a request through the{" "}
          <Link href="/audit" className={linkCls}>
            assessment page
          </Link>{" "}
          doesn&apos;t create an engagement or commit either of us to anything.
          We&apos;ll follow up, and if we both want to go ahead, the fee,
          deliverables, and any credit toward implementation are set out in the
          written agreement you sign before work starts. Pricing on the site
          describes how engagements are structured; your actual figures are in
          the proposal and agreement we give you.
        </p>
      </LegalSection>

      <LegalSection title="Demo calls and the receptionist demo">
        <LegalList
          items={[
            "Answers on demo calls and in the receptionist demo are generated automatically and can be wrong. Don't rely on them for decisions.",
            "Nothing a demo says is medical, legal, financial, or other professional advice.",
            "The demos aren't monitored for emergencies. If you have an emergency, call 911.",
            "Please use fictional details on demo calls. Don't share anything sensitive.",
          ]}
        />
      </LegalSection>

      <LegalSection title="Acceptable use">
        <p>When you use the site, please don&apos;t:</p>
        <LegalList
          items={[
            "try to reach areas that require a login, or get around any access control;",
            "overload, scan, or scrape the site, or use automated tools to call the demo numbers;",
            "submit someone else's personal information without their permission, or impersonate anyone;",
            "use the site or demos for anything unlawful, or to send harmful or abusive content; or",
            "copy the demos or site to build a competing product.",
          ]}
        />
        <p>We may block access from anyone who doesn&apos;t follow these rules.</p>
      </LegalSection>

      <LegalSection title="Our content">
        <p>
          The ResponseOS name, logo, site content, and demos belong to AJ
          Digital LLC. You may view and share links to them to evaluate
          ResponseOS. Any other use needs our written permission. If you send
          us feedback or suggestions, we may use them without owing you
          anything.
        </p>
      </LegalSection>

      <LegalSection title="Privacy">
        <p>
          How we handle information you give us is described in our{" "}
          <Link href="/privacy" className={linkCls}>
            privacy policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Other sites">
        <p>
          The site links to other websites, such as our social profiles. We
          don&apos;t control them and aren&apos;t responsible for their
          content or practices.
        </p>
      </LegalSection>

      <LegalSection title="No warranties">
        <p>
          The site and demos are provided &ldquo;as is&rdquo; and &ldquo;as
          available.&rdquo; To the extent the law allows, we make no
          warranties, express or implied, including that the site will be
          accurate, uninterrupted, or error-free, or fit for a particular
          purpose. ResponseOS is not HIPAA-certified or HIPAA-compliant.
        </p>
      </LegalSection>

      <LegalSection title="Limits on our liability">
        <p>
          To the extent the law allows, AJ Digital LLC isn&apos;t liable for
          any indirect, incidental, special, consequential, or punitive
          damages, or for lost profits, revenue, or data, arising from your
          use of the site or demos. Our total liability for any claim about
          the site or demos is limited to $100. These limits don&apos;t apply
          to paid work, which is governed by its written agreement.
        </p>
      </LegalSection>

      <LegalSection title="Changes and ending access">
        <p>
          We may change these terms, and we&apos;ll update the date at the top
          when we do. Using the site after a change means you accept the
          updated terms. We may change, suspend, or stop the site or any demo
          at any time.
        </p>
      </LegalSection>

      <LegalSection title="Governing law">
        <p>
          These terms are governed by the laws of the State of Florida,
          without regard to its conflict-of-law rules. Any dispute about them
          will be heard in the state or federal courts located in Florida, and
          you and we agree to those courts&apos; jurisdiction.
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
