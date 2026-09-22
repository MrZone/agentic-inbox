// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { Loader } from "@cloudflare/kumo";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { useNavigate } from "react-router";
import api from "~/services/api";
import { useMailboxes } from "~/queries/mailboxes";
import { queryKeys } from "~/queries/keys";

export function meta() {
	return [{ title: "Agentic Inbox" }];
}

/**
 * Landing route. Redirects straight into the default mailbox's inbox so
 * multi-mailbox users don't have to pick from a list every time. Falls back
 * to the first configured mailbox, and to the full mailbox list if none
 * exist yet.
 */
export default function HomeRoute() {
	const navigate = useNavigate();
	const { data: configData, isFetched: configFetched } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity,
	});
	const { data: mailboxes = [], isFetched: mailboxesFetched } = useMailboxes();

	useEffect(() => {
		if (!configFetched || !mailboxesFetched) return;

		const emailAddresses = configData?.emailAddresses ?? [];
		// When EMAIL_ADDRESSES is configured, that list is the source of truth
		// for which mailboxes should exist (mirrors app/routes/mailboxes.tsx).
		// Otherwise fall back to whatever mailboxes have actually been created.
		const candidateEmails =
			emailAddresses.length > 0
				? emailAddresses
				: mailboxes.map((m) => m.email);

		if (candidateEmails.length === 0) {
			navigate("/mailboxes", { replace: true });
			return;
		}

		const defaultMailbox = configData?.defaultMailbox;
		const targetEmail =
			defaultMailbox &&
			candidateEmails.some(
				(e) => e.toLowerCase() === defaultMailbox.toLowerCase(),
			)
				? defaultMailbox
				: candidateEmails[0];

		const emailToMailboxId = new Map(
			mailboxes.map((m) => [m.email.toLowerCase(), m.id]),
		);
		const targetId =
			emailToMailboxId.get(targetEmail.toLowerCase()) ?? targetEmail;

		navigate(`/mailbox/${targetId}/emails/inbox`, { replace: true });
	}, [configData, configFetched, mailboxes, mailboxesFetched, navigate]);

	return (
		<div className="flex min-h-screen items-center justify-center bg-kumo-recessed">
			<Loader size="lg" />
		</div>
	);
}
