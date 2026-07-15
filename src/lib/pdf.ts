import html2canvas from "html2canvas";
import jsPDF from "jspdf";

/**
 * Render an arbitrary HTML string to an A4 jsPDF document (multi-page). Used by
 * the document templates for "Save PDF" and "Save to Vault". The caller is
 * responsible for proxying any cross-origin images (see proxy-image route).
 */
export async function renderHtmlToPdf(html: string): Promise<jsPDF> {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:794px;padding:48px 56px;background:#fff";
  holder.innerHTML = html;
  document.body.appendChild(holder);
  // Wait for images (e.g. the logo) to finish loading before snapshotting.
  await Promise.all(
    Array.from(holder.querySelectorAll("img")).map((img) =>
      img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })
    )
  );
  const canvas = await html2canvas(holder, { scale: 2, useCORS: true, backgroundColor: "#ffffff", logging: false });
  document.body.removeChild(holder);

  const pdf = new jsPDF("p", "mm", "a4");
  const img = canvas.toDataURL("image/jpeg", 0.92);
  // No margin here — templates are pre-padded by the outer holder div (48px x 56px).
  paginateImage(pdf, img, "JPEG", canvas.width, canvas.height, 0, [], 794);
  return pdf;
}

// Capture an element at a FIXED desktop width regardless of viewport.
// On mobile the live preview renders at phone width (~375px), so snapshotting
// it directly produced a narrow, extremely tall canvas that paginated into
// dozens of A4 pages. Cloning into an offscreen 800px holder forces the
// desktop layout for the capture without touching what's on screen.
export type PdfLinkRect = { x: number; y: number; width: number; height: number; url: string };

async function captureAtDesktopWidth(element: HTMLElement, scale: number): Promise<{ canvas: HTMLCanvasElement; links: PdfLinkRect[]; cssWidth: number }> {
  const holder = document.createElement("div");
  holder.style.cssText = "position:fixed;left:-99999px;top:0;width:800px;background:#fff";
  const clone = element.cloneNode(true) as HTMLElement;
  clone.removeAttribute("id"); // avoid duplicate ids while attached
  clone.style.maxWidth = "800px";
  clone.style.width = "800px";
  holder.appendChild(clone);
  document.body.appendChild(holder);
  try {
    await Promise.all(
      Array.from(holder.querySelectorAll("img")).map((img) =>
        img.complete ? Promise.resolve() : new Promise((res) => { img.onload = img.onerror = () => res(null); })
      )
    );
    const canvas = await html2canvas(clone, {
      scale,
      useCORS: true,
      logging: false,
      backgroundColor: "#ffffff",
      windowWidth: 1280, // render responsive CSS at desktop breakpoint
    });
    // Record every clickable link's position (CSS px, relative to the clone's
    // own top-left) so the caller can stamp real jsPDF link annotations onto
    // the rasterized page — html2canvas only draws pixels, it can't carry
    // hyperlinks through, so without this a PDF's links are dead text.
    const holderRect = holder.getBoundingClientRect();
    const links: PdfLinkRect[] = Array.from(clone.querySelectorAll("a[href]")).map((a) => {
      const r = (a as HTMLElement).getBoundingClientRect();
      return { x: r.left - holderRect.left, y: r.top - holderRect.top, width: r.width, height: r.height, url: (a as HTMLAnchorElement).href };
    });
    return { canvas, links, cssWidth: 800 };
  } finally {
    document.body.removeChild(holder);
  }
}

export async function downloadPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const { canvas, links, cssWidth } = await captureAtDesktopWidth(element, 2);

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  paginateImage(pdf, imgData, "PNG", canvas.width, canvas.height, 10, links, cssWidth);
  pdf.save(filename);
}

// Slice a tall canvas image across A4 pages with a 10mm border on all sides.
//
// Two independent bugs this replaces:
//   1. Multi-page OVERLAP — the old step (277mm) didn't match the actual
//      visible content band on page 1 (287mm because there was no bottom
//      clip), so page 2 re-showed the last 10mm of page 1.
//   2. LONELY FOOTER on page 2 — `DocumentPreview` has `minHeight: 1120px`
//      (one A4 page at 96dpi) but real invoices push canvas ~30–100px past
//      that, so the strict step created a page 2 containing only the footer
//      strip. Fix: scale-to-fit when the image is within 15% of one page.
//
// The step (`availH`) MUST equal the visible content band or consecutive
// pages will overlap; the white margin bands enforce that band by clipping
// overflow so the image only "shows" inside [margin, pageH-margin].
function paginateImage(
  pdf: jsPDF,
  imgData: string,
  fmt: "PNG" | "JPEG",
  canvasW: number,
  canvasH: number,
  margin = 10,
  links: PdfLinkRect[] = [],
  cssWidth = 800,
): void {
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const availW = pageW - 2 * margin;
  const availH = pageH - 2 * margin;
  const naturalImgH = (canvasH * availW) / canvasW;
  // mm per CSS px in the captured clone — the scale factor is isotropic
  // (aspect-preserving), so this same ratio applies to both x and y.
  const k = availW / cssWidth;

  // Single-page fast path: if the element fits (or overshoots by ≤ 15% —
  // the "invoice with minHeight 1120px just barely spilled" case), scale it
  // proportionally to fit ONE page. No pagination, no lonely footer page.
  if (naturalImgH <= availH * 1.15) {
    const finalH = Math.min(naturalImgH, availH);
    const finalW = (canvasW * finalH) / canvasH;
    const xOffset = (pageW - finalW) / 2;
    pdf.addImage(imgData, fmt, xOffset, margin, finalW, finalH);
    const s = finalH / naturalImgH; // extra shrink applied when clipped to one page
    for (const l of links) {
      pdf.link(xOffset + l.x * k * s, margin + l.y * k * s, l.width * k * s, l.height * k * s, { url: l.url });
    }
    return;
  }

  // Multi-page: draw the full image at increasing negative offsets and white
  // out the top/bottom margin bands so overflow doesn't leak between pages.
  let shown = 0;
  let first = true;
  while (shown < naturalImgH) {
    if (!first) pdf.addPage();
    first = false;
    pdf.addImage(imgData, fmt, margin, margin - shown, availW, naturalImgH);
    pdf.setFillColor(255, 255, 255);
    pdf.rect(0, 0, pageW, margin, "F");
    pdf.rect(0, pageH - margin, pageW, margin, "F");
    for (const l of links) {
      const mmY = margin + l.y * k - shown;
      if (mmY >= margin - 1 && mmY + l.height * k <= pageH - margin + 1) {
        pdf.link(margin + l.x * k, mmY, l.width * k, l.height * k, { url: l.url });
      }
    }
    shown += availH;
  }
}

/**
 * Render a DOM element to an A4 PDF and return its base64 (no data-URI prefix),
 * suitable for emailing as an attachment (Resend `content`). Mirrors downloadPdf
 * but returns the bytes instead of triggering a download. Client-side only.
 */
export async function pdfBase64FromElement(elementId: string): Promise<string | null> {
  const element = document.getElementById(elementId);
  if (!element) return null;

  const { canvas, links, cssWidth } = await captureAtDesktopWidth(element, 1.6);

  // JPEG (not PNG): a full-page invoice PNG is several MB, and its base64 blows
  // past the serverless request-body limit → the send API returns 413. JPEG at
  // q0.8 is ~10× smaller and visually fine for a document scan.
  const imgData = canvas.toDataURL("image/jpeg", 0.8);
  const pdf = new jsPDF("p", "mm", "a4");
  paginateImage(pdf, imgData, "JPEG", canvas.width, canvas.height, 10, links, cssWidth);
  // "data:application/pdf;...;base64,XXXX" → "XXXX"
  return pdf.output("datauristring").split(",")[1] ?? null;
}
