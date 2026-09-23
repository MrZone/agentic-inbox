// Copyright (c) 2026 Cloudflare, Inc.
// Licensed under the Apache 2.0 license found in the LICENSE file or at:
//     https://opensource.org/licenses/Apache-2.0

import {
	Badge,
	Button,
	Dialog,
	Empty,
	Input,
	Loader,
	Text,
	Tooltip,
	useKumoToastManager,
} from "@cloudflare/kumo";
import { EnvelopeIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { useQuery } from "@tanstack/react-query";
import { type FormEvent, useState } from "react";
import { Link as RouterLink } from "react-router";
import api from "~/services/api";
import {
	useCreateMailbox,
	useDeleteMailbox,
	useMailboxes,
} from "~/queries/mailboxes";
import { useMailboxUnreadCounts } from "~/queries/folders";
import { queryKeys } from "~/queries/keys";

/**
 * Shows the unread count for a mailbox, split into the primary (non-spam)
 * count and a de-emphasized spam count — spam unread shouldn't compete
 * visually with mail that actually needs attention.
 */
function MailboxUnreadBadge({ mailboxId }: { mailboxId: string }) {
	const { nonSpamCount, spamCount } = useMailboxUnreadCounts(mailboxId);
	if (nonSpamCount === 0 && spamCount === 0) return null;
	return (
		<div className="flex items-center gap-1 shrink-0">
			{nonSpamCount > 0 && (
				<Badge variant="secondary" aria-label={`${nonSpamCount} unread`}>
					{nonSpamCount > 99 ? "99+" : nonSpamCount}
				</Badge>
			)}
			{spamCount > 0 && (
				<Tooltip content={`${spamCount} unread in Spam`} asChild>
					<Badge
						variant="outline"
						className="text-kumo-subtle border-kumo-line"
						aria-label={`${spamCount} unread in Spam`}
					>
						{spamCount > 99 ? "99+" : spamCount} spam
					</Badge>
				</Tooltip>
			)}
		</div>
	);
}

export function meta() {
	return [{ title: "Mailboxes — Agentic Inbox" }];
}

export default function MailboxesRoute() {
	const toastManager = useKumoToastManager();
	const { data: mailboxes = [] } = useMailboxes();
	const createMailbox = useCreateMailbox();
	const deleteMailbox = useDeleteMailbox();

	const { data: configData } = useQuery({
		queryKey: queryKeys.config,
		queryFn: () => api.getConfig(),
		staleTime: Infinity, // config rarely changes
	});

	const domains = configData?.domains ?? [];
	const emailAddresses = configData?.emailAddresses ?? [];

	const [isCreateOpen, setIsCreateOpen] = useState(false);
	const [newEmail, setNewEmail] = useState("");
	const [newName, setNewName] = useState("");
	const [isCreating, setIsCreating] = useState(false);
	const [createError, setCreateError] = useState<string | null>(null);
	const [isDeleteOpen, setIsDeleteOpen] = useState(false);
	const [mailboxToDelete, setMailboxToDelete] = useState<{
		id: string;
		email: string;
	} | null>(null);
	const [isDeleting, setIsDeleting] = useState(false);

	// Mailboxes are auto-created from EMAIL_ADDRESSES by useAutoCreateMailboxes,
	// mounted once at the app root (app/root.tsx) so it runs on every landing
	// route, not just this page.

	const handleCreate = async (e: FormEvent) => {
		e.preventDefault();
		setCreateError(null);
		const email = newEmail.trim().toLowerCase();
		if (!email) {
			setCreateError("Please enter an email address");
			return;
		}
		const name = newName || email.split("@")[0] || email;
		setIsCreating(true);
		try {
			await createMailbox.mutateAsync({ email, name });
			toastManager.add({ title: "Mailbox created successfully!" });
			setIsCreateOpen(false);
			setNewEmail("");
			setNewName("");
		} catch (err: unknown) {
			const message = (err instanceof Error ? err.message : null) || "Failed to create mailbox";
			setCreateError(message);
		} finally {
			setIsCreating(false);
		}
	};

	const handleDelete = async () => {
		if (!mailboxToDelete) return;
		setIsDeleting(true);
		try {
			await deleteMailbox.mutateAsync(mailboxToDelete.id);
			toastManager.add({ title: "Mailbox deleted" });
			setIsDeleteOpen(false);
			setMailboxToDelete(null);
		} catch {
			toastManager.add({ title: "Failed to delete mailbox", variant: "error" });
		} finally {
			setIsDeleting(false);
		}
	};

	const isConfigured = emailAddresses.length > 0;
	const accounts = isConfigured
		? emailAddresses.map((addr) => ({
				id: addr,
				email: addr,
				name: addr.split("@")[0] || addr,
			}))
		: mailboxes;

	// Map email → real mailbox ID so we can always pass the backend ID to the
	// folders API regardless of whether isConfigured mode is active.
	const emailToMailboxId = new Map(
		mailboxes.map((m) => [m.email.toLowerCase(), m.id]),
	);

	const isLoading = !configData;

	return (
		<div className="min-h-screen bg-kumo-recessed">
			<div className="mx-auto max-w-2xl px-4 py-8 md:px-6 md:py-16">
				<div className="mb-8">
					<div className="flex items-center justify-between">
						<h1 className="text-2xl font-bold text-kumo-default">Mailboxes</h1>
						{!isConfigured && (
							<Button
								variant="primary"
								icon={<PlusIcon size={16} />}
								onClick={() => setIsCreateOpen(true)}
							>
								New Mailbox
							</Button>
						)}
					</div>
					{domains.length > 0 && (
						<p className="text-sm text-kumo-subtle mt-1">
							{domains.join(", ")}
						</p>
					)}
				</div>

				{isLoading ? (
					<div className="flex justify-center py-20">
						<Loader size="lg" />
					</div>
				) : accounts.length > 0 ? (
					<div className="rounded-xl border border-kumo-line bg-kumo-base overflow-hidden">
						{accounts.map((account, idx) => {
							const realMailboxId =
								emailToMailboxId.get(account.email.toLowerCase()) ?? account.id;
							return (
								<RouterLink
									key={account.id}
									to={`/mailbox/${account.id}`}
									className={`group flex items-center gap-4 px-5 py-4 no-underline transition-colors hover:bg-kumo-tint ${
										idx > 0 ? "border-t border-kumo-line" : ""
									}`}
								>
									<div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-kumo-fill text-sm font-bold text-kumo-default">
										{account.name.charAt(0).toUpperCase()}
									</div>
									<div className="min-w-0 flex-1">
										<div className="text-sm font-medium text-kumo-default truncate">
											{account.name}
										</div>
										<div className="text-sm text-kumo-subtle">
											{account.email}
										</div>
									</div>
									<MailboxUnreadBadge mailboxId={realMailboxId} />
									{!isConfigured && (
										<Button
											variant="ghost"
											size="sm"
											shape="square"
											icon={<TrashIcon size={16} />}
											aria-label={`Delete mailbox ${account.email}`}
											onClick={(e) => {
												e.preventDefault();
												e.stopPropagation();
												setMailboxToDelete({
													id: account.id,
													email: account.email,
												});
												setIsDeleteOpen(true);
											}}
										/>
									)}
								</RouterLink>
							);
						})}
					</div>
				) : (
					<div className="rounded-xl border border-kumo-line bg-kumo-base py-16 px-6">
						<div className="flex flex-col items-center text-center">
							<div className="mb-4">
								<EnvelopeIcon
									size={48}
									weight="thin"
									className="text-kumo-subtle"
								/>
							</div>
							<h3 className="text-base font-semibold text-kumo-default mb-1.5">
								No mailboxes yet
							</h3>
							<p className="text-sm text-kumo-subtle max-w-sm mb-5">
								{isConfigured
									? "Your email routing is configured but no mailboxes have been created yet. They will appear here automatically."
									: "Create a mailbox to start sending and receiving emails with your domain."}
							</p>
							{!isConfigured && (
								<Button
									variant="primary"
									icon={<PlusIcon size={16} />}
									onClick={() => setIsCreateOpen(true)}
								>
									Create Mailbox
								</Button>
							)}
						</div>
					</div>
				)}
			</div>

			{/* Create Dialog */}
			<Dialog.Root open={isCreateOpen} onOpenChange={setIsCreateOpen}>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-5">
						Create New Mailbox
					</Dialog.Title>
					<form onSubmit={handleCreate} className="space-y-4">
						{createError && (
							<Text variant="error" size="sm">
								{createError}
							</Text>
						)}
						<Input
							label="Email Address"
							type="email"
							placeholder="info@yoursite.com"
							size="sm"
							value={newEmail}
							onChange={(e) => setNewEmail(e.target.value)}
							required
						/>
						<Input
							label="Display Name (optional)"
							placeholder="Info"
							size="sm"
							value={newName}
							onChange={(e) => setNewName(e.target.value)}
						/>
						<div className="flex justify-end gap-2 pt-2">
							<Dialog.Close
								render={(props) => (
									<Button {...props} variant="secondary" size="sm">
										Cancel
									</Button>
								)}
							/>
							<Button
								type="submit"
								variant="primary"
								size="sm"
								loading={isCreating}
								disabled={!newEmail}
							>
								Create
							</Button>
						</div>
					</form>
				</Dialog>
			</Dialog.Root>

			{/* Delete Dialog */}
			<Dialog.Root
				open={isDeleteOpen}
				onOpenChange={(open) => {
					setIsDeleteOpen(open);
					if (!open) setMailboxToDelete(null);
				}}
			>
				<Dialog size="sm" className="p-6">
					<Dialog.Title className="text-base font-semibold mb-2">
						Delete Mailbox
					</Dialog.Title>
					<Dialog.Description className="text-kumo-subtle text-sm mb-5">
						Are you sure you want to delete{" "}
						<strong className="text-kumo-default">
							{mailboxToDelete?.email}
						</strong>
						? This action cannot be undone.
					</Dialog.Description>
					<div className="flex justify-end gap-2">
						<Dialog.Close
							render={(props) => (
								<Button {...props} variant="secondary" size="sm">
									Cancel
								</Button>
							)}
						/>
						<Button
							variant="destructive"
							size="sm"
							loading={isDeleting}
							onClick={handleDelete}
						>
							Delete
						</Button>
					</div>
				</Dialog>
			</Dialog.Root>
		</div>
	);
}
