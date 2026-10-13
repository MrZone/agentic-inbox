// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Env } from "../types";
import { stripHtmlToText } from "./email-helpers";

const PREVIEW_MAX_CHARS = 50;

/**
 * Build a short plain-text preview of the email body for the notification.
 * Prefers the text/plain part; falls back to stripped HTML. Drops quoted
 * reply history so a reply's preview shows the new content, not the thread.
 */
export function buildBodyPreview(text: string | undefined, html: string | undefined): string {
	let body = text?.trim() ? text : stripHtmlToText(html || "");
	body = body
		.replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&lt;/gi, "<")
		.replace(/&gt;/gi, ">").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'");
	// Cut at the first quoted-reply marker (Gmail/Outlook/Chinese clients).
	const quoteMarker = /(^|\n)\s*(>|On .{1,200}wrote:|-{2,}\s*Original Message|在.{1,100}写道[:：]|发件人[:：]|From:\s)/i;
	const m = body.match(quoteMarker);
	if (m && m.index !== undefined && m.index > 0) body = body.slice(0, m.index);
	body = body.replace(/\s+/g, " ").trim();
	// Slice by code point so an emoji at the cut doesn't become a broken surrogate.
	const chars = Array.from(body);
	return chars.length > PREVIEW_MAX_CHARS ? `${chars.slice(0, PREVIEW_MAX_CHARS).join("")}…` : body;
}

/**
 * Notify a Feishu group (via a custom bot webhook) that a new email arrived.
 *
 * Best-effort: swallows all errors so a Feishu outage never fails email
 * ingestion (the caller's `receiveEmail` re-throws on error, which would
 * otherwise make Cloudflare retry/bounce the message). Call this inside
 * `ctx.waitUntil(...)`.
 */
export async function notifyFeishuNewEmail(
	env: Env,
	params: { mailboxId: string; sender: string; senderName?: string; subject: string; preview?: string; attachmentCount?: number },
): Promise<void> {
	const webhookUrl = env.FEISHU_WEBHOOK_URL;
	if (!webhookUrl) return;

	const subject = params.subject || "(no subject)";
	const sender = params.senderName ? `${params.senderName} <${params.sender}>` : params.sender;
	const lines = [`📬 新邮件到达`, `邮箱：${params.mailboxId}`, `发件人：${sender}`, `主题：${subject}`];
	if (params.attachmentCount) lines.push(`附件：${params.attachmentCount} 个`);
	if (params.preview) lines.push("", params.preview);
	const text = lines.join("\n");

	try {
		const res = await fetch(webhookUrl, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ msg_type: "text", content: { text } }),
		});
		if (!res.ok) {
			console.error(`Feishu notification failed: ${res.status} ${await res.text().catch(() => "")}`);
		}
	} catch (e) {
		console.error("Feishu notification failed:", (e as Error).message);
	}
}
