#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import tls from "node:tls";

const PERPLEXITY_CHAT_COMPLETIONS_URL = "https://api.perplexity.ai/chat/completions";
const OPENROUTER_MESSAGES_API_URL = "https://openrouter.ai/api/v1/messages";
const ANTHROPIC_MESSAGES_API_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";

function usage() {
  console.log(
    [
      "Usage:",
      "  node scripts/generate-outreach-drafts.mjs --input <leads.csv> [--limit <n>] [--dry-run]",
      "  node scripts/generate-outreach-drafts.mjs --txt <names.txt> [--limit <n>] [--dry-run]",
      "  node scripts/generate-outreach-drafts.mjs --name \"Full Name\" [--email person@site.com] [--profile-url https://...] [--dry-run]",
      "",
      "Input modes:",
      "  --input <csv> : CSV with first_name plus optional fields",
      "  --txt <txt>   : one lead per line",
      "  --name <name> : one-off lead from CLI",
      "",
      "TXT line format:",
      "  Name",
      "  Name|email|profile_url|role|company|creative_domain|notes",
      "",
      "Required env:",
      "  PERPLEXITY_API_KEY",
      "  OUTREACH_SMTP_USER",
      "  OUTREACH_SMTP_APP_PASSWORD",
      "  OUTREACH_SMTP_FROM",
      "",
      "SMTP optional env:",
      "  OUTREACH_SMTP_HOST (default: smtp.gmail.com)",
      "  OUTREACH_SMTP_PORT (default: 465)",
      "",
      "Model env (at least one provider path):",
      "  OPENROUTER_API_KEY (preferred) or ANTHROPIC_API_KEY",
      "",
      "Optional env:",
      "  PERPLEXITY_PEOPLE_RESEARCH_MODEL (default: sonar-pro)",
      "  OUTREACH_SONNET_MODEL_OPENROUTER (default: anthropic/claude-sonnet-4.5)",
      "  OUTREACH_SONNET_MODEL_ANTHROPIC (default: claude-sonnet-4-5)",
      "  OUTREACH_SIGNATURE_NAME (default: Naman)",
      "",
      "Output behavior:",
      "  Always writes numbered per-person draft .txt files under reports/outreach-email-files-<timestamp>/"
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    inputPath: "",
    txtPath: "",
    name: "",
    email: "",
    profileUrl: "",
    limit: Number.POSITIVE_INFINITY,
    dryRun: false
  };

  for (let i = 2; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--input") {
      args.inputPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--txt") {
      args.txtPath = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--name") {
      args.name = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--email") {
      args.email = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--profile-url") {
      args.profileUrl = argv[i + 1] ?? "";
      i += 1;
      continue;
    }
    if (token === "--limit") {
      const parsed = Number.parseInt(argv[i + 1] ?? "", 10);
      args.limit = Number.isFinite(parsed) && parsed > 0 ? parsed : Number.POSITIVE_INFINITY;
      i += 1;
      continue;
    }
    if (token === "--dry-run") {
      args.dryRun = true;
      continue;
    }
    if (token === "--help" || token === "-h") {
      usage();
      process.exit(0);
    }
    throw new Error(`UNKNOWN_ARG: ${token}`);
  }

  if (!args.inputPath && !args.txtPath && !args.name) {
    throw new Error("MISSING_INPUT_SOURCE");
  }

  return args;
}

function readEnv(name) {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function requireEnv(name) {
  const value = readEnv(name);
  if (!value) {
    throw new Error(`MISSING_ENV:${name}`);
  }
  return value;
}

function firstNameFromAny(value) {
  const normalized = String(value ?? "").trim().replace(/\s+/g, " ");
  return normalized.split(" ")[0] ?? "";
}

function parseCsv(text) {
  const rows = [];
  let field = "";
  let row = [];
  let inQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      field = "";
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      continue;
    }

    field += char;
  }

  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  if (rows.length === 0) return [];

  const headers = rows[0].map((value) => value.trim());
  return rows.slice(1).map((cells) => {
    const record = {};
    headers.forEach((header, idx) => {
      record[header] = (cells[idx] ?? "").trim();
    });
    const fullName = record.full_name || record.name || record.first_name || "";
    return {
      ...record,
      full_name: fullName,
      first_name: (record.first_name || firstNameFromAny(fullName || record.email || "")).trim()
    };
  });
}

function parseTxtLeads(text) {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split("|").map((part) => part.trim());
      const name = parts[0] ?? "";
      const firstName = firstNameFromAny(name);
      return {
        full_name: name,
        first_name: firstName,
        email: parts[1] ?? "",
        profile_url: parts[2] ?? "",
        role: parts[3] ?? "",
        company: parts[4] ?? "",
        creative_domain: parts[5] ?? "",
        notes: parts[6] ?? ""
      };
    });
}

function extractJsonObject(rawText) {
  const trimmed = rawText.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) return JSON.parse(trimmed);

  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenced?.[1]) return JSON.parse(fenced[1]);

  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));

  throw new Error("JSON_PARSE_FAILED");
}

async function runPerplexityChat({ systemPrompt, userPrompt }) {
  const apiKey = requireEnv("PERPLEXITY_API_KEY");
  const model = readEnv("PERPLEXITY_PEOPLE_RESEARCH_MODEL") ?? "sonar-pro";

  const response = await fetch(PERPLEXITY_CHAT_COMPLETIONS_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });

  if (!response.ok) throw new Error(`PERPLEXITY_HTTP_${response.status}`);
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) throw new Error("PERPLEXITY_EMPTY_RESPONSE");

  const parsed = extractJsonObject(content);
  const citations = Array.isArray(json?.citations) ? json.citations.filter((item) => typeof item === "string") : [];
  return { parsed, citations };
}

async function resolveLeadIdentity(lead) {
  if (lead.email && lead.profile_url) {
    return { resolvedLead: lead, identity: null, identityCitations: [] };
  }

  const payload = {
    full_name: lead.full_name || lead.first_name,
    known_email: lead.email || null,
    known_profile_url: lead.profile_url || null,
    role: lead.role || null,
    company: lead.company || null,
    creative_domain: lead.creative_domain || null,
    notes: lead.notes || null
  };

  const { parsed, citations } = await runPerplexityChat({
    systemPrompt: [
      "You resolve outreach lead identity from public web information.",
      "Return strict JSON only:",
      "{",
      '  "full_name": "string",',
      '  "best_profile_url": "string or empty",',
      '  "best_contact_email": "string or empty",',
      '  "confidence": 0.0,',
      '  "notes": "short string"',
      "}",
      "Rules:",
      "- Do not invent contact data.",
      "- Prefer portfolio/company/about pages and professional profiles.",
      "- If email is not confidently available, return empty string."
    ].join("\n"),
    userPrompt: JSON.stringify(payload, null, 2)
  });

  const resolvedLead = {
    ...lead,
    full_name: (parsed.full_name || lead.full_name || lead.first_name || "").trim(),
    first_name: (lead.first_name || firstNameFromAny(parsed.full_name || lead.full_name || "")).trim(),
    email: (lead.email || parsed.best_contact_email || "").trim(),
    profile_url: (lead.profile_url || parsed.best_profile_url || "").trim()
  };

  return {
    resolvedLead,
    identity: parsed,
    identityCitations: citations
  };
}

async function runPerplexityPersonResearch(lead) {
  const leadContext = [
    `name: ${lead.full_name || lead.first_name || "unknown"}`,
    `email: ${lead.email || "unknown"}`,
    `profile_url: ${lead.profile_url || "unknown"}`,
    `role: ${lead.role || "unknown"}`,
    `company: ${lead.company || "unknown"}`,
    `creative_domain: ${lead.creative_domain || "unknown"}`,
    `notes: ${lead.notes || "none"}`
  ].join("\n");

  return runPerplexityChat({
    systemPrompt: [
      "You are a research assistant for highly personalized outreach.",
      "Find only verifiable public facts about the person.",
      "Do not invent information.",
      "Return strict JSON only in this shape:",
      "{",
      '  "role_summary": "string",',
      '  "recent_work_or_post": "string",',
      '  "creative_focus": "string",',
      '  "connection_tidbit": "string",',
      '  "fit_reason": "string",',
      '  "facts": [{"claim":"string","source_url":"https://...","confidence":0.0}]',
      "}",
      "Rules:",
      "- Use 2-4 facts max.",
      "- confidence must be in [0,1].",
      "- If unsure, use lower confidence and keep claim conservative.",
      "- If evidence is weak, still return JSON with best effort and short strings."
    ].join("\n"),
    userPrompt: leadContext
  });
}

async function callSonnetForPersonalization(lead, research) {
  const openRouterApiKey = readEnv("OPENROUTER_API_KEY");
  const anthropicApiKey = readEnv("ANTHROPIC_API_KEY");
  const modelOpenRouter = readEnv("OUTREACH_SONNET_MODEL_OPENROUTER") ?? "anthropic/claude-sonnet-4.5";
  const modelAnthropic = readEnv("OUTREACH_SONNET_MODEL_ANTHROPIC") ?? "claude-sonnet-4-5";

  if (!openRouterApiKey && !anthropicApiKey) {
    throw new Error("MISSING_ENV:OPENROUTER_API_KEY_OR_ANTHROPIC_API_KEY");
  }

  const provider = openRouterApiKey
    ? {
        url: OPENROUTER_MESSAGES_API_URL,
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${openRouterApiKey}`,
          "anthropic-version": ANTHROPIC_VERSION
        },
        model: modelOpenRouter
      }
    : {
        url: ANTHROPIC_MESSAGES_API_URL,
        headers: {
          "content-type": "application/json",
          "x-api-key": anthropicApiKey,
          "anthropic-version": ANTHROPIC_VERSION
        },
        model: modelAnthropic
      };

  const response = await fetch(provider.url, {
    method: "POST",
    headers: provider.headers,
    body: JSON.stringify({
      model: provider.model,
      max_tokens: 620,
      temperature: 0.35,
      system: [
        "You write highly personalized outreach drafts for one specific person.",
        "Allow moderate freeform adaptation while preserving the sender's core message.",
        "You may rewrite phrasing for fluency and personalization, but do not change the core intent.",
        "No hype, no fake familiarity, no invented facts.",
        "Avoid AI-sounding patterns: no generic startup cliches, no robotic transitions, no obvious template rhythm.",
        "Write like a thoughtful human teen builder: specific, slightly informal, clear, direct, and non-corporate.",
        "Keep it concise and human: 110-180 words, plain text, no bullets, no emojis.",
        "Use available evidence to add a few authentic connection details.",
        "Subject line should be creative, specific, and curiosity-inducing without clickbait.",
        "Prefer unusual but natural phrasing over generic subjects like 'Quick note' or 'Reaching out'.",
        "Body must still communicate all of these points clearly:",
        "- Naman is a 14-year-old builder in San Ramon.",
        "- No-Circles helps people break algorithmic bubbles.",
        "- It sends tangent, intentionally non-news, un-Googlable information.",
        "- As interests evolve, the daily issue evolves.",
        "- A sense of purpose on the web has been lost and Naman wants to fix that.",
        "- Closing is respectful and signed Naman.",
        "Output strict JSON only:",
        "{",
        '  "subject": "string (<= 12 words)",',
        '  "body": "string (plain-text email body)",',
        '  "confidence": 0.0',
        "}"
      ].join("\n"),
      messages: [
        {
          role: "user",
          content: [
            "Lead:",
            JSON.stringify(lead, null, 2),
            "",
            "Research evidence:",
            JSON.stringify(research, null, 2),
            "",
            "Base message (you can adapt wording moderately, but keep intent and key points):",
            "I’m Naman, a 14-year-old builder in San Ramon. I’ve been [Personalized Connection to their work].",
            "I’ve been building a project called No-Circles. The goal is to help people break out of their usual algorithmic bubbles to find purposefully niche information.",
            "Every day, it sends you information tangent to your interests (purposefully, not news), to find you un-Googlable information.",
            "It is hard enough to find information about things you love, and even harder about things you know little about. As your interests evolve, your daily issue evolves.",
            "Somewhere along the way, we lost a portion of purpose for the web, and I want to fix that.",
            "With deep respect for the clarity you bring to the web,",
            "Naman"
          ].join("\n")
        }
      ]
    })
  });

  if (!response.ok) throw new Error(`SONNET_HTTP_${response.status}`);

  const json = await response.json();
  const text =
    json?.content
      ?.filter((chunk) => chunk?.type === "text" && typeof chunk?.text === "string")
      .map((chunk) => chunk.text.trim())
      .filter(Boolean)
      .join("\n")
      .trim() ?? "";

  if (!text) throw new Error("SONNET_EMPTY_RESPONSE");
  return extractJsonObject(text);
}

function enforceCoreMessaging(body) {
  let normalized = String(body ?? "").replace(/\r\n/g, "\n").trim();
  const signature = readEnv("OUTREACH_SIGNATURE_NAME") ?? "Naman";

  if (!/14-year-old builder in San Ramon/i.test(normalized)) {
    normalized = `I’m Naman, a 14-year-old builder in San Ramon.\n\n${normalized}`.trim();
  }

  if (!/No-Circles/i.test(normalized)) {
    normalized += "\n\nI’ve been building a project called No-Circles to help people break out of their usual algorithmic bubbles.";
  }

  if (!/un-Googlable/i.test(normalized) || !/tangent/i.test(normalized)) {
    normalized += "\n\nEvery day, it sends tangent, intentionally non-news, un-Googlable information.";
  }

  if (!/interests evolve/i.test(normalized) || !/issue evolves/i.test(normalized)) {
    normalized += "\n\nAs your interests evolve, your daily issue evolves.";
  }

  if (!/purpose.*web/i.test(normalized) || !/fix that/i.test(normalized)) {
    normalized += "\n\nSomewhere along the way, we lost a portion of purpose for the web, and I want to fix that.";
  }

  if (!new RegExp(`\\b${signature}\\s*$`, "i").test(normalized)) {
    normalized += `\n\nWith deep respect for the clarity you bring to the web,\n${signature}`;
  }

  return normalized.trim();
}

function slugifyFileName(value) {
  return String(value ?? "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

function formatLeadEmailText({ lead, subject, body }) {
  const toEmail = lead.email?.trim() ? lead.email.trim() : "[MISSING_EMAIL]";
  return [
    `To: ${toEmail}`,
    `Name: ${lead.full_name || lead.first_name || "Unknown"}`,
    `Subject: ${subject}`,
    "",
    body
  ].join("\n");
}

function writeLeadDraftFile({ draftsDir, index, lead, subject, body }) {
  const number = String(index + 1).padStart(3, "0");
  const nameSlug = slugifyFileName(lead.full_name || lead.first_name || "unknown");
  const fileName = `${number}-${nameSlug || "unknown"}.txt`;
  const outputPath = path.join(draftsDir, fileName);
  fs.writeFileSync(outputPath, formatLeadEmailText({ lead, subject, body }) + "\n");
  return outputPath;
}

function smtpDotStuff(text) {
  return text
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => (line.startsWith(".") ? `.${line}` : line))
    .join("\r\n");
}

function onceData(socket) {
  return new Promise((resolve, reject) => {
    const onData = (chunk) => {
      socket.off("error", onError);
      resolve(chunk.toString("utf8"));
    };
    const onError = (error) => {
      socket.off("data", onData);
      reject(error);
    };
    socket.once("data", onData);
    socket.once("error", onError);
  });
}

function extractSmtpCode(message) {
  const line = String(message).split(/\r?\n/).find(Boolean) ?? "";
  const match = line.match(/^(\d{3})[\s-]/);
  return match ? Number.parseInt(match[1], 10) : null;
}

async function smtpExpect(socket, expectedPrefix) {
  const message = await onceData(socket);
  const code = extractSmtpCode(message);
  if (!code || String(code)[0] !== String(expectedPrefix)) {
    throw new Error(`SMTP_UNEXPECTED_RESPONSE:${message.trim()}`);
  }
  return message;
}

function smtpWrite(socket, line) {
  socket.write(`${line}\r\n`);
}

async function sendViaSmtp({ toEmail, subject, body }) {
  const host = readEnv("OUTREACH_SMTP_HOST") ?? "smtp.gmail.com";
  const port = Number.parseInt(readEnv("OUTREACH_SMTP_PORT") ?? "465", 10);
  const user = requireEnv("OUTREACH_SMTP_USER");
  const appPassword = requireEnv("OUTREACH_SMTP_APP_PASSWORD");
  const fromEmail = requireEnv("OUTREACH_SMTP_FROM");

  const socket = tls.connect({ host, port, servername: host, rejectUnauthorized: true });
  await new Promise((resolve, reject) => {
    socket.once("secureConnect", resolve);
    socket.once("error", reject);
  });

  await smtpExpect(socket, 2);
  smtpWrite(socket, "EHLO localhost");
  await smtpExpect(socket, 2);

  smtpWrite(socket, "AUTH LOGIN");
  await smtpExpect(socket, 3);
  smtpWrite(socket, Buffer.from(user, "utf8").toString("base64"));
  await smtpExpect(socket, 3);
  smtpWrite(socket, Buffer.from(appPassword, "utf8").toString("base64"));
  await smtpExpect(socket, 2);

  smtpWrite(socket, `MAIL FROM:<${fromEmail}>`);
  await smtpExpect(socket, 2);
  smtpWrite(socket, `RCPT TO:<${toEmail}>`);
  await smtpExpect(socket, 2);
  smtpWrite(socket, "DATA");
  await smtpExpect(socket, 3);

  const mime = [
    `From: Naman <${fromEmail}>`,
    `To: ${toEmail}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset="UTF-8"',
    "Content-Transfer-Encoding: 7bit",
    "",
    smtpDotStuff(body)
  ].join("\r\n");

  socket.write(`${mime}\r\n.\r\n`);
  await smtpExpect(socket, 2);
  smtpWrite(socket, "QUIT");
  socket.end();

  return { host, port, user };
}

function validateLead(lead, index) {
  if (!lead.first_name) {
    throw new Error(`INVALID_LEAD_ROW_${index + 2}: missing first_name/name`);
  }
}

function collectLeads(args) {
  const all = [];

  if (args.inputPath) {
    const csvPath = path.resolve(process.cwd(), args.inputPath);
    const csvText = fs.readFileSync(csvPath, "utf8");
    all.push(...parseCsv(csvText));
  }

  if (args.txtPath) {
    const txtPath = path.resolve(process.cwd(), args.txtPath);
    const txtText = fs.readFileSync(txtPath, "utf8");
    all.push(...parseTxtLeads(txtText));
  }

  if (args.name) {
    all.push({
      full_name: args.name.trim(),
      first_name: firstNameFromAny(args.name),
      email: args.email.trim(),
      profile_url: args.profileUrl.trim()
    });
  }

  return all.slice(0, args.limit);
}

async function main() {
  const args = parseArgs(process.argv);
  const leads = collectLeads(args);

  if (leads.length === 0) throw new Error("EMPTY_INPUT");
  leads.forEach(validateLead);

  const results = [];
  const runStamp = new Date().toISOString().replace(/[:.]/g, "-");
  const outputDir = path.join(process.cwd(), "reports");
  const draftsDir = path.join(outputDir, `outreach-email-files-${runStamp}`);
  fs.mkdirSync(draftsDir, { recursive: true });

  for (let i = 0; i < leads.length; i += 1) {
    const rawLead = leads[i];
    process.stdout.write(`\n[${i + 1}/${leads.length}] ${rawLead.full_name || rawLead.first_name} ... `);

    try {
      const { resolvedLead, identity, identityCitations } = await resolveLeadIdentity(rawLead);
      const research = await runPerplexityPersonResearch(resolvedLead);
      const personalization = await callSonnetForPersonalization(resolvedLead, research.parsed);
      const subject = String(personalization.subject ?? "").trim() || `Quick note for ${resolvedLead.first_name}`;
      const body = enforceCoreMessaging(personalization.body);
      const draftFilePath = writeLeadDraftFile({ draftsDir, index: i, lead: resolvedLead, subject, body });

      let smtp = null;
      let status = "ok";
      if (!args.dryRun) {
        if (resolvedLead.email) {
          smtp = await sendViaSmtp({ toEmail: resolvedLead.email, subject, body });
        } else {
          status = "needs_email";
        }
      }

      results.push({
        inputLead: rawLead,
        lead: resolvedLead,
        identity,
        identityCitations,
        research: research.parsed,
        citations: research.citations,
        personalization,
        subject,
        body,
        draftFilePath: path.relative(process.cwd(), draftFilePath),
        smtp,
        status
      });

      if (args.dryRun) {
        process.stdout.write("dry-run-ok");
      } else if (status === "needs_email") {
        process.stdout.write("generated-no-email");
      } else {
        process.stdout.write("smtp-sent");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
      results.push({ inputLead: rawLead, status: "error", error: message });
      process.stdout.write(`error (${message})`);
    }
  }

  fs.mkdirSync(outputDir, { recursive: true });
  const outputPath = path.join(outputDir, `outreach-smtp-run-${runStamp}.json`);
  fs.writeFileSync(
    outputPath,
    JSON.stringify({ createdAt: new Date().toISOString(), dryRun: args.dryRun, draftsDir: path.relative(process.cwd(), draftsDir), results }, null, 2) + "\n"
  );

  const successCount = results.filter((item) => item.status === "ok").length;
  const noEmailCount = results.filter((item) => item.status === "needs_email").length;
  const errorCount = results.length - successCount - noEmailCount;
  console.log(`\n\nDone. success=${successCount}, needs_email=${noEmailCount}, error=${errorCount}`);
  console.log(`Draft files: ${path.relative(process.cwd(), draftsDir)}`);
  console.log(`Report: ${path.relative(process.cwd(), outputPath)}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
