import { PublicPage, REPO_URL } from "@/components/layout/PublicPage";

export default function Terms() {
  return (
    <PublicPage title="Terms of Service" subtitle="Last updated: October 2026">
      <h2>Using LinkFusion</h2>
      <p>You may create short links and QR codes for lawful purposes. You are responsible for the links you create and where they lead.</p>

      <h2>Not allowed</h2>
      <ul>
        <li>Phishing, malware, scams or links that impersonate others.</li>
        <li>Content that is illegal, or that infringes others' rights.</li>
        <li>Spam, or attempts to overload, scan or bypass the service's security controls.</li>
      </ul>
      <p>Administrators may disable links that break these rules, and remove accounts that repeatedly do so.</p>

      <h2>No warranty</h2>
      <p>
        LinkFusion is provided "as is", without warranties of any kind, and without guaranteed availability. Links may stop
        working if they expire, reach their click limit, or are disabled by you or an administrator.
      </p>

      <h2>Your data</h2>
      <p>See the <a href="/privacy">Privacy Policy</a>. You can export your data or delete your account at any time from your profile.</p>

      <h2>Software</h2>
      <p>LinkFusion is open source under the MIT License: <a href={REPO_URL} rel="noopener noreferrer">{REPO_URL.replace("https://", "")}</a>.</p>
    </PublicPage>
  );
}
