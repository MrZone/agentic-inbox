// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Folders } from "shared/folders";
import api from "~/services/api";
import type { Folder } from "~/types";
import { queryKeys } from "./keys";

export function useFolders(mailboxId: string | undefined) {
	return useQuery<Folder[]>({
		queryKey: mailboxId
			? queryKeys.folders.list(mailboxId)
			: ["folders", "_disabled"],
		queryFn: () => api.listFolders(mailboxId!) as Promise<Folder[]>,
		enabled: !!mailboxId,
	});
}

export interface MailboxUnreadCounts {
	/** Unread count across every folder, spam included. */
	total: number;
	/** Unread count excluding spam — what "unread" means to the user. */
	nonSpamCount: number;
	/** Unread count in the spam folder only. */
	spamCount: number;
}

/** Splits a mailbox's aggregate unread count into spam vs. non-spam. */
export function useMailboxUnreadCounts(
	mailboxId: string | undefined,
): MailboxUnreadCounts {
	const { data: folders = [] } = useFolders(mailboxId);
	return folders.reduce<MailboxUnreadCounts>(
		(acc, f) => {
			const count = f.unreadCount ?? 0;
			acc.total += count;
			if (f.id === Folders.SPAM) {
				acc.spamCount += count;
			} else {
				acc.nonSpamCount += count;
			}
			return acc;
		},
		{ total: 0, nonSpamCount: 0, spamCount: 0 },
	);
}

export function useCreateFolder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			name,
		}: { mailboxId: string; name: string }) =>
			api.createFolder(mailboxId, name),
		onSuccess: (_data, { mailboxId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.folders.list(mailboxId) });
		},
	});
}

export function useUpdateFolder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			id,
			name,
		}: { mailboxId: string; id: string; name: string }) =>
			api.updateFolder(mailboxId, id, name),
		onSuccess: (_data, { mailboxId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.folders.list(mailboxId) });
		},
	});
}

export function useDeleteFolder() {
	const qc = useQueryClient();
	return useMutation({
		mutationFn: ({
			mailboxId,
			id,
		}: { mailboxId: string; id: string }) =>
			api.deleteFolder(mailboxId, id),
		onSuccess: (_data, { mailboxId }) => {
			qc.invalidateQueries({ queryKey: queryKeys.folders.list(mailboxId) });
		},
	});
}
