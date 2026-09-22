// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import type { Env } from "../types";

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
	params: { mailboxId: string; sender: string; subject: string },
): Promise<void> {
	const webhookUrl = env.FEISHU_WEBHOOK_URL;
	if (!webhookUrl) return;

	const subject = params.subject || "(no subject)";
	const text = `📬 新邮件到达\n邮箱：${params.mailboxId}\n发件人：${params.sender}\n主题：${subject}`;

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
