import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/presentational";

export const metadata: Metadata = {
  title: "About",
  description: "Who publishes Left Field, what it is for, and what the site does and does not collect.",
};

export default function About() {
  return (
    <Shell>
      <main id="content" className="page prose about-page">
        <p className="eyebrow">ABOUT</p>
        <h1>Who publishes this</h1>
        <p className="lede">
          Left Field is published by SUBCULT and is part of the{" "}
          <a href="https://subcult.tv">subcult.tv</a> network.
        </p>

        <section className="record-section">
          <h2>What it is</h2>
          <p>
            A research index of seats in Congress, governorships, and state
            legislatures. Each seat is scored from public election, geography,
            and campaign-finance records, and every score shows the inputs
            behind it. The <Link href="/methodology">Method</Link> page gives
            the formulas and the <Link href="/sources">source ledger</Link>{" "}
            lists what is retained and what is missing.
          </p>
          <p>
            A score orders where investigation may be most useful. It is not a
            forecast, a poll, or an endorsement. The site does not profile
            voters, and missing information is shown as missing.
          </p>
        </section>

        <section className="record-section">
          <h2>What the site collects</h2>
          <dl>
            <dt>Accounts and tracking</dt>
            <dd>
              There are no accounts. The pages load no analytics, advertising,
              or other third-party scripts.
            </dd>
            <dt>Address lookup</dt>
            <dd>
              Off unless a deployment has passed privacy review. The{" "}
              <Link prefetch={false} href="/lookup">lookup page</Link> states
              its current status.
            </dd>
            <dt>Corrections</dt>
            <dd>
              Correction intake follows the same rule. The{" "}
              <Link prefetch={false} href="/corrections">corrections page</Link>{" "}
              states whether reports are being accepted.
            </dd>
          </dl>
        </section>

        <section className="record-section">
          <h2>Contact</h2>
          <p>
            Reach the publisher through{" "}
            <a href="https://subcult.tv">subcult.tv</a>. To report an error in
            a published record, use the correction link on that seat record.
          </p>
        </section>
      </main>
    </Shell>
  );
}
