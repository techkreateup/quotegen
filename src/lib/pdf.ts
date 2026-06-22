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
  const pageW = pdf.internal.pageSize.getWidth();
  const pageH = pdf.internal.pageSize.getHeight();
  const imgW = pageW;
  const imgH = (canvas.height * imgW) / canvas.width;
  const img = canvas.toDataURL("image/jpeg", 0.92);
  let heightLeft = imgH;
  let position = 0;
  pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
  heightLeft -= pageH;
  while (heightLeft > 0) {
    position -= pageH;
    pdf.addPage();
    pdf.addImage(img, "JPEG", 0, position, imgW, imgH);
    heightLeft -= pageH;
  }
  return pdf;
}

export async function downloadPdf(elementId: string, filename: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const canvas = await html2canvas(element, {
    scale: 2,
    useCORS: true,
    logging: false,
    backgroundColor: "#ffffff",
  });

  const imgData = canvas.toDataURL("image/png");
  const pdf = new jsPDF("p", "mm", "a4");
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const imgWidth = pdfWidth - 20;
  const imgHeight = (canvas.height * imgWidth) / canvas.width;

  let heightLeft = imgHeight;
  let position = 10;

  pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
  heightLeft -= pdfHeight - 20;

  while (heightLeft > 0) {
    position = heightLeft - imgHeight + 10;
    pdf.addPage();
    pdf.addImage(imgData, "PNG", 10, position, imgWidth, imgHeight);
    heightLeft -= pdfHeight - 20;
  }

  pdf.save(filename);
}
