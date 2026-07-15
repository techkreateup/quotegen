"use client";

import { Fragment } from "react";
import { CompanySettings, LineItem } from "@/lib/types";
import { numberToWords, formatDate, currencySymbol } from "@/lib/store";

interface DocumentPreviewProps {
  id: string;
  type: "Quotation" | "Invoice" | "Export Invoice" | "Payment Receipt" | "Sales Order" | "Delivery Challan" | "Proforma Invoice" | "Purchase Order" | "Goods Receipt Note" | "Debit Note";
  // ISO code or symbol for export invoices ("USD", "€"). Default: INR (₹).
  currency?: string;
  documentNo: string;
  date: string;
  dueDate?: string;
  title: string;
  status: string;
  settings: CompanySettings;
  clientName: string;
  clientAddress?: string;
  clientPhone?: string;
  clientEmail?: string;
  clientGstin?: string;
  items?: LineItem[];
  subtotal?: number;
  totalDiscount?: number;
  totalCgst?: number;
  totalSgst?: number;
  totalIgst?: number;
  additionalCharges?: number;
  additionalChargesLabel?: string;
  roundOff?: number;
  totalAmount: number;
  notes?: string;
  termsAndConditions?: string;
  paymentMethod?: string;
  referenceNo?: string;
  invoiceNo?: string;
  paymentDate?: string;
}

export default function DocumentPreview(props: DocumentPreviewProps) {
  const {
    id, type, documentNo, date, dueDate, title, settings,
    clientName, clientAddress, clientPhone, clientEmail, clientGstin,
    items, subtotal, totalDiscount, totalCgst, totalSgst, totalIgst, additionalCharges, additionalChargesLabel, roundOff, totalAmount,
    notes, termsAndConditions, paymentMethod, referenceNo, invoiceNo, paymentDate,
  } = props;

  const cur = currencySymbol(props.currency);
  // Route UploadThing logo URLs through the same-origin proxy so html2canvas
  // can capture them into a PDF without a cross-origin canvas taint (the taint
  // silently drops/misaligns the logo on download while it still displays fine
  // live in the browser, since <img> display isn't CORS-gated but canvas reads are).
  const logoSrc = settings.logoUrl && /^https:\/\/[a-z0-9.-]*(ufs\.sh|utfs\.io)\//i.test(settings.logoUrl)
    ? `/api/proxy-image?url=${encodeURIComponent(settings.logoUrl)}`
    : settings.logoUrl;

  const theme = settings.themeColor || "#7c3aed";
  const themeBg = theme + "12";
  const FROM_LABELS: Record<string, string> = {
    "Invoice": "Billed By", "Export Invoice": "Exporter", "Proforma Invoice": "Billed By", "Payment Receipt": "Received By",
    "Sales Order": "Order From", "Delivery Challan": "Dispatched By", "Purchase Order": "Ordered By",
    "Goods Receipt Note": "Received By", "Debit Note": "Debit Raised By", "Quotation": "Quotation From",
  };
  const TO_LABELS: Record<string, string> = {
    "Invoice": "Billed To", "Export Invoice": "Consignee (Bill To)", "Proforma Invoice": "Billed To", "Payment Receipt": "Received From",
    "Sales Order": "Order For", "Delivery Challan": "Ship To", "Purchase Order": "Vendor",
    "Goods Receipt Note": "Vendor", "Debit Note": "Vendor", "Quotation": "Quotation For",
  };
  const fromLabel = FROM_LABELS[type] ?? "From";
  const toLabel = TO_LABELS[type] ?? "To";
  const footerText = settings.contactFooter || (settings.email ? `For any enquiry, reach out via email at ${settings.email}${settings.phones?.[0] ? `, call on ${settings.phones[0]}` : ""}` : "");
  const disclaimerText = settings.documentFooter || "This is an electronically generated document, no signature is required.";

  const isInterState = (totalIgst ?? 0) > 0 && (totalCgst ?? 0) === 0 && (totalSgst ?? 0) === 0;
  const hasAnyHsn = items?.some(item => item.hsnSac && item.hsnSac.trim() !== "") ?? false;

  const hsnSummary: Record<string, { hsn: string; taxable: number; cgstRate: number; cgstAmt: number; sgstRate: number; sgstAmt: number; igstRate: number; igstAmt: number; total: number }> = {};
  items?.forEach((item) => {
    if (!item.hsnSac || !item.hsnSac.trim()) return;
    const key = item.hsnSac;
    if (!hsnSummary[key]) hsnSummary[key] = { hsn: key, taxable: 0, cgstRate: item.gstRate / 2, cgstAmt: 0, sgstRate: item.gstRate / 2, sgstAmt: 0, igstRate: item.gstRate, igstAmt: 0, total: 0 };
    hsnSummary[key].taxable += item.amount;
    hsnSummary[key].cgstAmt += item.cgst;
    hsnSummary[key].sgstAmt += item.sgst;
    hsnSummary[key].igstAmt += item.igst;
    hsnSummary[key].total += item.total;
  });

  return (
    <div id={id} className="document-preview bg-white p-8 max-w-[800px] mx-auto" style={{ fontFamily: "Arial, Helvetica, sans-serif", fontSize: "13px", color: "#333", minHeight: "1120px", display: "flex", flexDirection: "column" }}>
      <div style={{ flex: 1 }}>
      <div className="flex justify-between items-start mb-6">
        <div>
          <h1 style={{ fontSize: "22px", fontWeight: "bold", color: theme, marginBottom: "4px" }}>{title}</h1>
          <p style={{ fontSize: "13px", color: "#666" }}>{type} No: <b style={{ color: "#333" }}>{documentNo}</b></p>
          <p style={{ fontSize: "13px", color: "#666" }}>{type} Date: {formatDate(date)}</p>
          {dueDate && <p style={{ fontSize: "13px", color: "#666" }}>Due Date: {formatDate(dueDate)}</p>}
          {paymentDate && <p style={{ fontSize: "13px", color: "#666" }}>Payment Date: {formatDate(paymentDate)}</p>}
        </div>
        <div style={{ textAlign: "right" }}>
          {settings.logoUrl ? <img src={logoSrc} alt="Logo" crossOrigin="anonymous" style={{ maxHeight: "60px", maxWidth: "180px", background: "#fff", padding: "4px", borderRadius: "6px", display: "inline-block", objectFit: "contain" }} /> :
            settings.businessName ? <p style={{ fontSize: "24px", fontWeight: "bold", color: theme }}>{settings.businessName}</p> : null}
        </div>
      </div>

      <div style={{ display: "flex", gap: "20px", marginBottom: "24px" }}>
        <div style={{ flex: 1, background: themeBg, padding: "16px", borderRadius: "8px", border: `1px solid ${theme}22` }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: theme, marginBottom: "8px" }}>{fromLabel}</h3>
          {settings.businessName && <p style={{ fontWeight: "600", marginBottom: "2px" }}>{settings.businessName}</p>}
          {settings.address && <p style={{ color: "#555", fontSize: "12px" }}>{settings.address}</p>}
          {(settings.city || settings.state || settings.country) && <p style={{ color: "#555", fontSize: "12px" }}>{[settings.city, settings.state, settings.country, settings.pincode].filter(Boolean).join(", ")}</p>}
          {settings.gstin && <p style={{ color: "#555", fontSize: "12px" }}>GSTIN: {settings.gstin}</p>}
          {settings.pan && <p style={{ color: "#555", fontSize: "12px" }}>PAN: {settings.pan}</p>}
          {settings.email && <p style={{ color: "#555", fontSize: "12px" }}>Email: {settings.email}</p>}
          {settings.phones?.filter(Boolean).map((ph, i) => <p key={i} style={{ color: "#555", fontSize: "12px" }}>Phone: {ph}</p>)}
        </div>
        <div style={{ flex: 1, background: themeBg, padding: "16px", borderRadius: "8px", border: `1px solid ${theme}22` }}>
          <h3 style={{ fontSize: "14px", fontWeight: "bold", color: theme, marginBottom: "8px" }}>{toLabel}</h3>
          <p style={{ fontWeight: "600", marginBottom: "2px" }}>{clientName}</p>
          {clientAddress && <p style={{ color: "#555", fontSize: "12px" }}>{clientAddress}</p>}
          {clientPhone && <p style={{ color: "#555", fontSize: "12px" }}>Phone: {clientPhone}</p>}
          {clientEmail && <p style={{ color: "#555", fontSize: "12px" }}>Email: {clientEmail}</p>}
          {clientGstin && <p style={{ color: "#555", fontSize: "12px" }}>GSTIN: {clientGstin}</p>}
        </div>
      </div>

      {type === "Payment Receipt" && (
        <div style={{ textAlign: "center", background: themeBg, padding: "24px", borderRadius: "8px", marginBottom: "24px" }}>
          <p style={{ fontSize: "14px", color: "#666", marginBottom: "4px" }}>Amount Received</p>
          <p style={{ fontSize: "32px", fontWeight: "bold", color: theme }}>{cur}{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</p>
          <p style={{ fontSize: "11px", color: "#888", marginTop: "4px" }}>{numberToWords(totalAmount, props.currency)}</p>
          {invoiceNo && <p style={{ fontSize: "12px", color: "#666", marginTop: "8px" }}>Against Invoice: <b>{invoiceNo}</b></p>}
          {paymentMethod && <p style={{ fontSize: "12px", color: "#666" }}>Payment Method: {paymentMethod}</p>}
          {referenceNo && <p style={{ fontSize: "12px", color: "#666" }}>Reference: {referenceNo}</p>}
        </div>
      )}

      {items && items.length > 0 && (
        <>
          <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: "16px" }}>
            <thead>
              <tr style={{ background: theme, color: "white" }}>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "12px" }}>#</th>
                <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "12px" }}>Item</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px" }}>GST Rate</th>
                <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px" }}>Qty</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>Rate</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>Discount</th>
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>Amount</th>
                {isInterState ? (
                  <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>IGST</th>
                ) : (
                  <>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>CGST</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>SGST</th>
                  </>
                )}
                <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item, i) => {
                // Total column count, so the description row can span the full width
                const colCount = isInterState ? 9 : 10;
                const hasDesc = !!(item.description && item.description.trim());
                return (
                  <Fragment key={item.id}>
                    <tr style={{ borderBottom: hasDesc ? "none" : "1px solid #eee" }}>
                      <td style={{ padding: "8px 10px", fontSize: "12px", verticalAlign: "top" }}>{i + 1}.</td>
                      <td style={{ padding: "8px 10px", verticalAlign: "top" }}>
                        <p style={{ fontSize: "12px", fontWeight: "500", color: "#222" }}>{item.itemName}</p>
                        {hasAnyHsn && item.hsnSac && <p style={{ fontSize: "10px", color: "#888" }}>HSN/SAC: {item.hsnSac}</p>}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", verticalAlign: "top" }}>{item.gstRate}%</td>
                      <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", verticalAlign: "top" }}>{item.quantity}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top" }}>{cur}{item.rate.toLocaleString("en-IN")}</td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top", color: item.discountAmount > 0 ? "#16a34a" : "#999" }}>
                        {item.discountAmount > 0 ? `-${cur}${item.discountAmount.toFixed(2)}` : "-"}
                      </td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top" }}>{cur}{item.amount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      {isInterState ? (
                        <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top" }}>{cur}{item.igst.toFixed(2)}</td>
                      ) : (
                        <>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top" }}>{cur}{item.cgst.toFixed(2)}</td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", verticalAlign: "top" }}>{cur}{item.sgst.toFixed(2)}</td>
                        </>
                      )}
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "600", verticalAlign: "top" }}>{cur}{item.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                    {hasDesc && (
                      <tr style={{ borderBottom: "1px solid #eee" }}>
                        <td />
                        <td colSpan={colCount - 1} style={{ padding: "0 10px 9px", fontSize: "11.5px", color: "#555", lineHeight: 1.5 }}>
                          {item.description}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>

          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "20px" }}>
            <p style={{ fontSize: "12px", color: "#666", fontStyle: "italic", maxWidth: "55%" }}>
              Total (in words): <b>{numberToWords(totalAmount).toUpperCase()}</b>
            </p>
            <div style={{ width: "260px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>Amount</span><span>{cur}{(subtotal ?? 0).toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
              {(totalDiscount ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px", color: "#16a34a" }}><span>Discount</span><span>-{cur}{(totalDiscount ?? 0).toFixed(2)}</span></div>}
              {isInterState ? (
                (totalIgst ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>IGST</span><span>{cur}{(totalIgst ?? 0).toFixed(2)}</span></div>
              ) : (
                <>
                  {(totalCgst ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>CGST</span><span>{cur}{(totalCgst ?? 0).toFixed(2)}</span></div>}
                  {(totalSgst ?? 0) > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>SGST</span><span>{cur}{(totalSgst ?? 0).toFixed(2)}</span></div>}
                </>
              )}
              {(additionalCharges ?? 0) !== 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>{additionalChargesLabel || "Additional Charges"}</span><span>{cur}{(additionalCharges ?? 0).toFixed(2)}</span></div>}
              {(roundOff ?? 0) !== 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: "12px" }}><span>Round Off</span><span>{(roundOff ?? 0) >= 0 ? "+" : ""}{cur}{(roundOff ?? 0).toFixed(2)}</span></div>}
              <div style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", fontSize: "14px", fontWeight: "bold", borderTop: "2px solid #333", marginTop: "4px" }}><span>Total (INR)</span><span>{cur}{totalAmount.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</span></div>
            </div>
          </div>

          {hasAnyHsn && Object.keys(hsnSummary).length > 0 && (() => {
            const hsnRows = Object.values(hsnSummary);
            const totalTaxable = hsnRows.reduce((s, r) => s + r.taxable, 0);
            const totalCgstAmt = hsnRows.reduce((s, r) => s + r.cgstAmt, 0);
            const totalSgstAmt = hsnRows.reduce((s, r) => s + r.sgstAmt, 0);
            const totalIgstAmt = hsnRows.reduce((s, r) => s + r.igstAmt, 0);
            const totalTax = isInterState ? totalIgstAmt : (totalCgstAmt + totalSgstAmt);
            const hsnTotal = hsnRows.reduce((s, r) => s + r.total, 0);
            return (
              <div style={{ marginBottom: "20px" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", border: "1px solid #ddd" }}>
                  <thead>
                    {/* Single-row header — rowSpan cells don't render reliably in html2canvas
                        (empty column heads in the PDF). Flattened `CGST/SGST Rate/Amount` for
                        both the screen and the export. */}
                    <tr style={{ background: "#f5f5f5" }}>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "12px", fontWeight: "600", border: "1px solid #ddd" }}>HSN</th>
                      <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "12px", fontWeight: "600", border: "1px solid #ddd" }}>Taxable Value</th>
                      {isInterState ? (
                        <>
                          <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>IGST Rate</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>IGST Amount</th>
                        </>
                      ) : (
                        <>
                          <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>CGST Rate</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>CGST Amount</th>
                          <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>SGST Rate</th>
                          <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "11.5px", fontWeight: "600", border: "1px solid #ddd" }}>SGST Amount</th>
                        </>
                      )}
                      <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "600", border: "1px solid #ddd" }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {hsnRows.map((row) => (
                      <tr key={row.hsn}>
                        <td style={{ padding: "8px 10px", fontSize: "12px", border: "1px solid #ddd" }}>{row.hsn}</td>
                        <td style={{ padding: "8px 10px", fontSize: "12px", border: "1px solid #ddd" }}>{cur}{row.taxable.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                        {isInterState ? (
                          <>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", border: "1px solid #ddd" }}>{row.igstRate}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", border: "1px solid #ddd" }}>{cur}{row.igstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                          </>
                        ) : (
                          <>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", border: "1px solid #ddd" }}>{row.cgstRate}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", border: "1px solid #ddd" }}>{cur}{row.cgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                            <td style={{ padding: "8px 10px", textAlign: "center", fontSize: "12px", border: "1px solid #ddd" }}>{row.sgstRate}%</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", border: "1px solid #ddd" }}>{cur}{row.sgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                          </>
                        )}
                        <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "500", border: "1px solid #ddd" }}>{cur}{row.total.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                      </tr>
                    ))}
                    <tr style={{ background: "#f5f5f5", fontWeight: "bold" }}>
                      <td style={{ padding: "8px 10px", fontSize: "12px", fontWeight: "700", border: "1px solid #ddd" }}>Total</td>
                      <td style={{ padding: "8px 10px", fontSize: "12px", fontWeight: "700", border: "1px solid #ddd" }}>{cur}{totalTaxable.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                      <td style={{ padding: "8px 10px", border: "1px solid #ddd" }}></td>
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "700", border: "1px solid #ddd" }}>{cur}{isInterState ? totalIgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 }) : totalCgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                      {!isInterState && (
                        <>
                          <td style={{ padding: "8px 10px", border: "1px solid #ddd" }}></td>
                          <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "700", border: "1px solid #ddd" }}>{cur}{totalSgstAmt.toLocaleString("en-IN", { minimumFractionDigits: 0 })}</td>
                        </>
                      )}
                      <td style={{ padding: "8px 10px", textAlign: "right", fontSize: "12px", fontWeight: "700", border: "1px solid #ddd" }}>{cur}{hsnTotal.toLocaleString("en-IN", { minimumFractionDigits: 2 })}</td>
                    </tr>
                  </tbody>
                </table>
                <div style={{ padding: "8px 10px", fontSize: "12px", fontWeight: "600", border: "1px solid #ddd", borderTop: "none", background: "#fafafa" }}>
                  Total Tax In Words: {numberToWords(totalTax).toUpperCase()}
                </div>
              </div>
            );
          })()}
        </>
      )}

      {settings.bankName && (
        <div style={{ marginBottom: "20px", padding: "12px 16px", background: "#fafafa", borderRadius: "6px", border: "1px solid #eee" }}>
          <h3 style={{ fontSize: "13px", fontWeight: "bold", color: theme, marginBottom: "6px" }}>Bank Details</h3>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px", fontSize: "12px" }}>
            <p>Account Name: <b>{settings.accountName}</b></p>
            <p>Account Number: <b>{settings.accountNumber}</b></p>
            <p>IFSC: <b>{settings.ifsc}</b></p>
            <p>Account Type: <b>{settings.accountType}</b></p>
            <p>Bank: <b>{settings.bankName}</b></p>
          </div>
        </div>
      )}

      {notes && <div style={{ marginBottom: "12px" }}><h3 style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>Notes</h3><p style={{ fontSize: "12px", color: "#666" }}>{notes}</p></div>}
      {termsAndConditions && <div style={{ marginBottom: "16px" }}><h3 style={{ fontSize: "12px", fontWeight: "bold", marginBottom: "4px" }}>Terms & Conditions</h3><p style={{ fontSize: "12px", color: "#666" }}>{termsAndConditions}</p></div>}

      </div>
      {/* Footer — pushed to bottom via flex */}
      <div style={{ marginTop: "auto" }}>
        <div style={{ borderTop: "2px dashed #ccc", padding: "12px 0 8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div style={{ display: "flex", gap: "32px", fontSize: "11px", color: "#555" }}>
            <div>
              <p style={{ color: "#999", fontSize: "10px", marginBottom: "2px" }}>{type} No</p>
              <p style={{ fontWeight: "600" }}>{documentNo}</p>
            </div>
            <div>
              <p style={{ color: "#999", fontSize: "10px", marginBottom: "2px" }}>{type} Date</p>
              <p style={{ fontWeight: "600" }}>{formatDate(date)}</p>
            </div>
            <div>
              <p style={{ color: "#999", fontSize: "10px", marginBottom: "2px" }}>{toLabel}</p>
              <p style={{ fontWeight: "600" }}>{clientName}</p>
            </div>
          </div>
          <p style={{ fontSize: "11px", color: "#888" }}>Page 1 of 1</p>
        </div>

        {type === "Export Invoice" && (
          <p style={{ fontSize: "10px", color: "#888", textAlign: "center", marginTop: "8px", fontWeight: 600 }}>
            SUPPLY MEANT FOR EXPORT UNDER LETTER OF UNDERTAKING (LUT) WITHOUT PAYMENT OF INTEGRATED TAX — Section 16, IGST Act 2017.
          </p>
        )}

        {type === "Proforma Invoice" && (
          <p style={{ fontSize: "10px", color: "#888", textAlign: "center", marginTop: "8px", fontWeight: 600 }}>
            This is a Proforma Invoice — not a tax invoice. Not valid for input tax credit under GST.
          </p>
        )}

        {footerText && (
          <p style={{ fontSize: "10px", color: "#888", textAlign: "center", marginTop: "8px", marginBottom: "4px" }}>{footerText}</p>
        )}

        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
          <p style={{ fontSize: "10px", color: "#aaa", fontStyle: "italic", maxWidth: "65%" }}>
            {disclaimerText}
          </p>
          {!settings.hideDefaultBrand && (
            <a href="https://quotegen.kreateup.in" target="_blank" rel="noopener noreferrer"
               style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: "11.5px", lineHeight: 1, color: "#888", textDecoration: "none" }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/brand/quotegen/QG_icon_SVG.svg" alt="" style={{ height: 16, width: 16, display: "inline-block", verticalAlign: "middle", background: "#fff", padding: 2, borderRadius: 3 }} />
              Made with <span style={{ color: theme, fontWeight: 600 }}>QuoteGen</span>
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
