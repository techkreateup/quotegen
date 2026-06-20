import Link from "next/link";

export const metadata = { title: "Privacy Policy — QuoteGen" };

export default function PrivacyPage() {
  return (
    <main className="max-w-3xl mx-auto px-6 py-12 text-slate-700">
      <Link href="/" className="text-sm text-indigo-600 font-semibold">← Back</Link>
      <h1 className="text-2xl font-bold text-slate-900 mt-4 mb-1">Privacy Policy</h1>
      <p className="text-sm text-slate-400 mb-8">Last updated: 18 June 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <p className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-amber-800">
          <strong>Placeholder.</strong> This is template content pending review by legal counsel
          before public launch. It is drafted with India&apos;s DPDP Act in mind.
        </p>

        <section>
          <h2 className="font-bold text-slate-900 mb-1">1. Information We Collect</h2>
          <p>Account details (name, email, company), the business data you enter (clients, invoices, employees), and usage/technical data such as log information.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">2. How We Use It</h2>
          <p>To provide and improve the Service, process payments, send transactional emails, and comply with legal obligations.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">3. Data Sharing</h2>
          <p>We share data only with processors necessary to run the Service (e.g. hosting, payments, email) under appropriate safeguards. We do not sell your data.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">4. Your Rights</h2>
          <p>You may access, correct, export, or delete your data. Export and account-deletion tools are available in your workspace settings.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">5. Data Retention</h2>
          <p>We retain your data while your account is active. On deletion, data is removed after a short grace period, except where retention is legally required.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">6. Security</h2>
          <p>We use industry-standard measures to protect your data, including encryption in transit and access controls.</p>
        </section>
        <section>
          <h2 className="font-bold text-slate-900 mb-1">7. Contact</h2>
          <p>For privacy requests, contact us through the in-app support channel.</p>
        </section>
      </div>
    </main>
  );
}
