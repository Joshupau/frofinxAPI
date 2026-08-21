// Ports the CSV parsing logic from fico-api's transactions.service.ts
// (normalizeKey/findField/parseCSV/parseImportDate/parseImportAmount/
// mapIndicator) near-verbatim — pure string/data logic with no DB
// dependency mid-parse, then hands the parsed rows to the
// transactions_bulk_import RPC for the atomic insert + wallet balance delta.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, jsonResponse } from "../_shared/cors.ts";

function normalizeKey(key: string): string {
  return key.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "");
}

function findField(row: Record<string, string>, ...keys: string[]): string {
  for (const key of keys) {
    const norm = normalizeKey(key);
    if (row[norm] !== undefined) return row[norm];
    const plain = norm.replace(/_/g, "");
    const match = Object.keys(row).find((k) => k.replace(/_/g, "") === plain);
    if (match !== undefined) return row[match];
  }
  return "";
}

function parseCSV(content: string): Record<string, string>[] {
  const cleaned = content.replace(/^﻿/, "");
  const lines = cleaned.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];

  const header = lines[0];
  const sep = header.includes("\t") ? "\t" : header.includes(";") ? ";" : ",";

  const parseLine = (line: string): string[] => {
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        if (inQ && line[i + 1] === '"') {
          cur += '"';
          i++;
        } else inQ = !inQ;
      } else if (c === sep && !inQ) {
        fields.push(cur.trim());
        cur = "";
      } else {
        cur += c;
      }
    }
    fields.push(cur.trim());
    return fields;
  };

  const headers = parseLine(header).map((h) => normalizeKey(h));
  return lines.slice(1).map((line) => {
    const vals = parseLine(line);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => {
      row[h] = vals[i] ?? "";
    });
    return row;
  });
}

function parseImportDate(s: string): Date | null {
  if (!s?.trim()) return null;
  const t = s.trim();
  if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(t)) {
    const d = new Date(t.replace(/\//g, "-"));
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{8}$/.test(t)) {
    const d = new Date(`${t.slice(0, 4)}-${t.slice(4, 6)}-${t.slice(6, 8)}`);
    return isNaN(d.getTime()) ? null : d;
  }
  if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(t)) {
    const [day, month, year] = t.split(/[-/]/);
    const d = new Date(`${year}-${month}-${day}`);
    return isNaN(d.getTime()) ? null : d;
  }
  const fallback = new Date(t);
  return isNaN(fallback.getTime()) ? null : fallback;
}

function parseImportAmount(s: string): number | null {
  if (!s?.trim()) return null;
  const c = s.trim().replace(/[€$£¥\s]/g, "");
  const norm = c.includes(",") && c.includes(".")
    ? c.replace(/\./g, "").replace(",", ".")
    : c.includes(",") && !c.includes(".")
    ? c.replace(",", ".")
    : c;
  const v = parseFloat(norm);
  return isNaN(v) ? null : Math.abs(v);
}

function mapIndicator(s: string): "income" | "expense" | null {
  const u = s.trim().toUpperCase();
  if (["CRDT", "CREDIT", "C", "CR"].includes(u)) return "income";
  if (["DBIT", "DEBIT", "D", "DR"].includes(u)) return "expense";
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return jsonResponse({ error: "Missing Authorization header." }, 401);

    // Runs with the CALLING user's JWT (not service role) so RLS/ownership
    // checks inside transactions_bulk_import apply normally.
    const client = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );

    const form = await req.formData();
    const walletId = form.get("walletId") as string | null;
    const categoryId = form.get("categoryId") as string | null;
    const preview = form.get("preview") === "true";
    const file = form.get("file") as File | null;

    if (!walletId || !file) {
      return jsonResponse({ error: "walletId and file are required." }, 400);
    }

    const content = await file.text();
    const rows = parseCSV(content);

    const { data: categories } = await client.from("categories").select("id, name");
    const allCategories = categories ?? [];

    const valid: {
      date: string;
      amount: number;
      type: "income" | "expense";
      description: string;
      tags: string[];
      category_id: string | null;
    }[] = [];
    const skipped: { row: number; reason: string }[] = [];

    rows.forEach((row, idx) => {
      const rowNum = idx + 2;

      let bookDate = findField(row, "Date and Time", "date and time", "datetime");
      if (!bookDate) {
        const dateField = findField(row, "Date", "date", "book date", "booking date", "value date");
        const timeField = findField(row, "Time", "time", "hour", "hours");
        bookDate = timeField ? `${dateField} ${timeField}` : dateField;
      }

      const debitStr = findField(row, "Debit", "debit");
      const creditStr = findField(row, "Credit", "credit");

      let amountStr = "";
      let indicator = "";
      if (debitStr?.trim() || creditStr?.trim()) {
        if (debitStr?.trim()) {
          amountStr = debitStr;
          indicator = "DEBIT";
        } else if (creditStr?.trim()) {
          amountStr = creditStr;
          indicator = "CREDIT";
        }
      } else {
        amountStr = findField(row, "Amount", "amount");
        indicator = findField(row, "Credit/debit indicator", "credit debit indicator", "indicator");
      }

      const description = findField(row, "Description", "description", "memo", "narration");
      const counterParty = findField(row, "Counter party name", "counterparty name", "beneficiary", "payee", "merchant");
      const txRef = findField(row, "Transaction reference", "transaction reference", "reference", "ref", "reference no");
      const txType = findField(row, "Transaction type", "transaction type");
      const txGroup = findField(row, "Transaction group", "transaction group");
      const csvCategory = findField(row, "Category", "category");
      const currency = findField(row, "Currency", "currency");
      const instructedAmt = findField(row, "Instructed amount", "instructed amount");
      const exchangeRate = findField(row, "Currency exchange rate", "exchange rate");
      const instructedCur = findField(row, "Instructed currency", "instructed currency");

      const parsedDate = parseImportDate(bookDate);
      if (!parsedDate) {
        skipped.push({ row: rowNum, reason: "missing_date" });
        return;
      }

      const parsedAmount = parseImportAmount(amountStr);
      if (parsedAmount === null || parsedAmount === 0) {
        skipped.push({ row: rowNum, reason: "invalid_amount" });
        return;
      }

      const type = mapIndicator(indicator);
      if (!type) {
        skipped.push({ row: rowNum, reason: "missing_indicator" });
        return;
      }

      if (!description.trim() && !counterParty.trim() && !txRef.trim()) {
        skipped.push({ row: rowNum, reason: "unidentifiable_system_payment" });
        return;
      }

      let finalDesc = description.trim() || counterParty.trim() || txRef.trim();
      if (counterParty.trim() && description.trim() && description.trim() !== counterParty.trim()) {
        finalDesc = `${description.trim()} · ${counterParty.trim()}`;
      }
      if (instructedAmt.trim() && instructedCur.trim() && instructedCur.trim() !== currency.trim()) {
        finalDesc += ` [${instructedCur.trim()} ${instructedAmt.trim()}${exchangeRate.trim() ? ` @ ${exchangeRate.trim()}` : ""}]`;
      }

      const tags: string[] = [];
      if (txType.trim()) tags.push(txType.trim());
      if (txGroup.trim() && txGroup.trim() !== txType.trim()) tags.push(txGroup.trim());

      let matchedCategoryId: string | null = null;
      if (csvCategory.trim()) {
        const cat = allCategories.find(
          (c: { id: string; name: string }) => c.name?.toLowerCase() === csvCategory.trim().toLowerCase(),
        );
        if (cat) matchedCategoryId = cat.id;
      }
      if (!matchedCategoryId && categoryId) matchedCategoryId = categoryId;

      valid.push({
        date: parsedDate.toISOString(),
        amount: parsedAmount,
        type,
        description: finalDesc,
        tags,
        category_id: matchedCategoryId,
      });
    });

    if (preview) {
      return jsonResponse({
        totalRows: rows.length,
        willImport: valid.length,
        willSkip: skipped.length,
        skippedRows: skipped,
        preview: valid,
      });
    }

    if (valid.length === 0) {
      return jsonResponse({
        message: "No valid transactions found to import.",
        totalRows: rows.length,
        imported: 0,
        skipped: skipped.length,
        skippedRows: skipped,
      });
    }

    const { data, error } = await client.rpc("transactions_bulk_import", {
      p_wallet_id: walletId,
      p_rows: valid,
    });
    if (error) throw error;

    return jsonResponse({
      message: `Successfully imported ${valid.length} transaction${valid.length !== 1 ? "s" : ""}.`,
      totalRows: rows.length,
      imported: data.imported,
      skipped: skipped.length,
      skippedRows: skipped,
    });
  } catch (err) {
    console.error("import-transactions error:", err);
    return jsonResponse({ error: "Failed to import transactions." }, 400);
  }
});
