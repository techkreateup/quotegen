import Link from "next/link";

export const metadata = { title: "Terms of Service — QuoteGen" };

export default function TermsPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-slate-700">
      <Link href="/" className="text-sm text-indigo-600 font-semibold">← Back</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-1">Terms of Service</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: 18 June 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <strong>Placeholder.</strong> This is template content pending review by legal counsel
          before public launch.
        </p>

        <section>
          <h2 className="font-bold text-slate-900 mb-1">1. Acceptance of Terms</h2>
          <p>By creating an account or using QuoteGen (&quot;the Service&quot;), you agree to be bound by these Terms of Service and our Privacy Policy.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">2. The Service</h2>
          <p>QuoteGen provides invoicing, quotation, and business-management tools on a subscription basis. We may modify or discontinue features with reasonable notice.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">3. Accounts &amp; Security</h2>
          <p>You are responsible for safeguarding your account credentials and for all activity under your account. Notify us immediately of any unauthorized use.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">4. Billing</h2>
          <p>Paid plans are billed in advance through our payment processor. Fees are non-refundable except where required by law. You may cancel at any time, effective at the end of the current billing period.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">5. Acceptable Use</h2>
          <p>You agree not to misuse the Service, including by attempting to access it through unauthorized means or using it for unlawful purposes.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">6. Data &amp; Privacy</h2>
          <p>Your use of the Service is also governed by our <Link href="/privacy" className="text-indigo-600 font-semibold">Privacy Policy</Link>. You retain ownership of the data you submit.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">7. Limitation of Liability</h2>
          <p>The Service is provided &quot;as is&quot;. To the maximum extent permitted by law, QuoteGen is not liable for indirect or consequential damages.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">8. Contact</h2>
          <p>Questions about these terms? Contact us through the in-app support channel.</p>
        </section>
      </div>
    </main>
  );
}
