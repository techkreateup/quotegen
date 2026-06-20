import { NextRequest, NextResponse } from "next/server";
import { prismaUnscoped } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { rateLimit, clientIp } from "@/lib/rate-limit";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// POST /api/support/tickets — public support ticket submission.
export async function POST(request: NextRequest) {
  if (!(await rateLimit(`support:${clientIp(request)}`, 5, 10 * 60_000))) {
    return NextResponse.json({ error: "Too many requests. Try again later." }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const name = String(body.name || "").trim();
  const email = String(body.email || "").trim().toLowerCase();
  const subject = String(body.subject || "").trim();
  const description = String(body.description || "").trim();

  if (!name || !subject || !description) {
    return NextResponse.json({ error: "Name, subject and description are required." }, { status: 400 });
  }
  if (!EMAIL_REGEX.test(email)) {
    return NextResponse.json({ error: "A valid email is required." }, { status: 400 });
  }

  const ticket = await prismaUnscoped.supportTicket.create({
    data: { name, email, subject, description },
  });

  // Confirmation to the customer (fire-and-forget).
  sendEmail({
    to: email,
    subject: "We received your support request — QuoteGen",
    html: `<div style="font-family:sans-serif;max-width:480px;margin:0 auto">
      <h2>Thanks, ${name}!</h2>
      <p>We've received your request and will get back to you soon.</p>
      <p><strong>Subject:</strong> ${subject}</p>
      <p>Reference: ${ticket.id}</p>
    </div>`,
  }).catch(() => {});

  return NextResponse.json({ ok: true, id: ticket.id }, { status: 201 });
}
