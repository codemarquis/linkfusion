import { PublicPage, REPO_URL } from "@/components/layout/PublicPage";

export default function Privacy() {
  return (
    <PublicPage title="Privacy Policy" subtitle="Last updated: October 2026">
      <p>LinkFusion is built to collect as little as possible. This page describes exactly what the software stores.</p>

      <h2>If you have an account</h2>
      <ul>
        <li><strong>Account data:</strong> your email address and name. If you sign up with email, a salted hash of your password (never the password itself). If you use Google or GitHub, the provider's account ID and, optionally, your avatar URL.</li>
        <li><strong>Your links:</strong> destination URLs, aliases, titles and settings you choose. Link passwords are stored only as hashes.</li>
        <li><strong>A session cookie</strong> (<code>HttpOnly</code>, <code>Secure</code>, <code>SameSite=Lax</code>) that keeps you signed in for up to 7 days. It's the only cookie we set.</li>
      </ul>

      <h2>If you click a short link</h2>
      <p>We record an anonymous click with:</p>
      <ul>
        <li>the <strong>country</strong>, looked up on our own server from your IP address, which is then discarded;</li>
        <li>the <strong>device type, browser and operating system</strong>, derived from your browser's user agent;</li>
        <li>the <strong>referring website's domain</strong> (not the full address).</li>
      </ul>
      <p>We do <strong>not</strong> store your IP address, your full user agent, your city, or any identifier that links clicks to you. Visitors get no cookies. Clicks from link-preview bots aren't counted.</p>

      <h2>What we don't do</h2>
      <ul>
        <li>No third-party analytics, advertising or tracking scripts.</li>
        <li>No selling or sharing of data. Sign-in providers (Google, GitHub) only receive what's needed to sign you in, and only if you choose them.</li>
      </ul>

      <h2>Your rights</h2>
      <p>
        Under <strong>Profile</strong> you can download all data we hold about you (JSON) and permanently delete your account,
        which also deletes your links and their click history immediately.
      </p>

      <h2>Contact</h2>
      <p>
        Questions about privacy: open an issue at <a href={REPO_URL + "/issues"} rel="noopener noreferrer">{REPO_URL.replace("https://", "")}</a>.
        Whoever operates a LinkFusion instance is the data controller for it.
      </p>
    </PublicPage>
  );
}
