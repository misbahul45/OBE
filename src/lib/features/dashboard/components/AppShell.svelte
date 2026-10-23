<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { CircleHelp, KeyRound, LogOut, UserRound } from '@lucide/svelte';
	import { Button } from '#lib/components/ui/button/index.ts';
	import { Separator } from '#lib/components/ui/separator/index.ts';
	import {
		Sidebar,
		SidebarContent,
		SidebarFooter,
		SidebarGroup,
		SidebarGroupContent,
		SidebarGroupLabel,
		SidebarHeader,
		SidebarInset,
		SidebarMenu,
		SidebarMenuButton,
		SidebarMenuItem,
		SidebarProvider,
		SidebarRail,
		SidebarTrigger
	} from '#lib/components/ui/sidebar/index.ts';
	import { Toaster } from '#lib/components/ui/sonner/index.ts';
	import { roleLabels, type SessionUser } from '#lib/features/auth/index.ts';
	import ThemeToggle from '#lib/shared/ui/ThemeToggle.svelte';
	import { isActive, navigationFor, pageTitleFor, type NavItem } from '../navigation.ts';

	let { user, children }: { user: SessionUser; children: Snippet } = $props();

	const groups = $derived(navigationFor(user.role));
	const current = $derived(groups.flatMap((group) => group.items).find((item) => isActive(item, page.url.pathname)));
</script>

<SidebarProvider>
	<Sidebar>
		<SidebarHeader class="px-4 py-4">
			<a href="/app" class="text-base font-semibold tracking-tight text-sidebar-foreground">OBE Teknik Biomedis</a>
			<p class="text-xs text-muted-foreground">{roleLabels[user.role]}</p>
		</SidebarHeader>
		<SidebarContent>
			{#each groups as group (group.label)}
				<SidebarGroup>
					<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
					<SidebarGroupContent>
						<SidebarMenu>
							{#each group.items as item (item.href)}
								{@const Icon = item.icon}
								<SidebarMenuItem>
									<SidebarMenuButton isActive={isActive(item as NavItem, page.url.pathname)}>
										{#snippet child({ props })}
											<a href={item.href} title={item.hint} {...props} aria-current={isActive(item as NavItem, page.url.pathname) ? 'page' : undefined}>
												<Icon aria-hidden="true" />
												<span>{item.title}</span>
											</a>
										{/snippet}
									</SidebarMenuButton>
								</SidebarMenuItem>
							{/each}
						</SidebarMenu>
					</SidebarGroupContent>
				</SidebarGroup>
			{/each}
		</SidebarContent>
		<SidebarFooter class="gap-2 border-t border-sidebar-border p-4">
			<a href="/app/account/profile" class="group flex min-w-0 items-center gap-2.5 rounded-md p-1 -m-1 hover:bg-sidebar-accent" title="Buka profil akun">
				<span aria-hidden="true" class="grid size-8 shrink-0 place-items-center rounded-full bg-primary-muted text-primary"><UserRound class="size-4" /></span>
				<span class="min-w-0">
					<span class="sr-only">Profil akun </span>
					<span class="block truncate text-sm font-medium text-sidebar-foreground">{user.name}</span>
					<span class="block truncate text-xs text-muted-foreground">{user.email}</span>
				</span>
			</a>
			<div class="flex gap-2">
				<Button href="/app/account/password" variant="secondary" size="sm" class="flex-1 gap-1.5">
					<KeyRound class="size-3.5" aria-hidden="true" />
					Password
				</Button>
				<form method="POST" action="/app/logout" class="flex-1">
					<Button type="submit" variant="secondary" size="sm" class="w-full gap-1.5">
						<LogOut class="size-3.5" aria-hidden="true" />
						Keluar
					</Button>
				</form>
			</div>
		</SidebarFooter>
		<SidebarRail />
	</Sidebar>

	<SidebarInset class="min-w-0">
		<header class="flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
			<SidebarTrigger aria-label="Buka atau tutup navigasi" />
			<Separator orientation="vertical" class="h-5" />
			<span class="truncate text-sm font-medium text-muted-foreground">{current?.title ?? pageTitleFor(page.url.pathname) ?? 'Aplikasi'}</span>
			<a href="/app/help" class="ml-auto flex shrink-0 items-center gap-1.5 rounded-md px-2 py-1 text-sm text-muted-foreground hover:bg-primary-soft hover:text-primary">
				<CircleHelp class="size-4" aria-hidden="true" />
				<span class="hidden sm:inline">Arti istilah</span>
				<span class="sr-only sm:hidden">Arti istilah</span>
			</a>
			<ThemeToggle />
		</header>
		<div class="min-w-0 flex-1 p-4 md:p-6">
			{@render children()}
		</div>
	</SidebarInset>
</SidebarProvider>
<Toaster richColors closeButton />
