import type { Component } from 'svelte';
import {
	BookOpen,
	Briefcase,
	CalendarRange,
	ClipboardCheck,
	FileText,
	FileUp,
	GraduationCap,
	History,
	Layers,
	LayoutDashboard,
	School,
	ScrollText,
	Target,
	Users
} from '@lucide/svelte';
import { appRoles, type AppRole } from '#lib/features/auth/index.ts';

export type NavItem = { title: string; href: string; icon: Component; hint: string; exact?: boolean };
export type NavGroup = { label: string; items: NavItem[] };

const adminNavigation: NavGroup[] = [
	{ label: 'Ringkasan', items: [{ title: 'Dashboard prodi', href: '/app/admin', icon: LayoutDashboard, hint: 'Ringkasan semester aktif dan langkah persiapan data', exact: true }] },
	{
		label: 'Kurikulum',
		items: [
			{ title: 'CPL dan CPMK', href: '/app/admin/curriculum', icon: Target, hint: 'Kelola CPL, CPMK per mata kuliah, pemetaan, dan kebijakan penilaian' },
			{ title: 'Profil lulusan', href: '/app/admin/profiles', icon: Briefcase, hint: 'Lihat hubungan CPL, profil lulusan, dan bidang kerja' }
		]
	},
	{
		label: 'Akademik',
		items: [
			{ title: 'Tahun akademik', href: '/app/admin/terms', icon: CalendarRange, hint: 'Buat tahun akademik dan semester, lalu aktifkan satu semester' },
			{ title: 'Mata kuliah', href: '/app/admin/courses', icon: BookOpen, hint: 'Daftar mata kuliah program studi' },
			{ title: 'Penawaran kelas', href: '/app/admin/offerings', icon: Layers, hint: 'Buka kelas mata kuliah pada semester dan tugaskan dosen pengampu' },
			{ title: 'Dosen', href: '/app/admin/lecturers', icon: Users, hint: 'Buat dan kelola akun dosen' }
		]
	},
	{
		label: 'Nilai dan mahasiswa',
		items: [
			{ title: 'Impor nilai', href: '/app/admin/imports', icon: FileUp, hint: 'Unggah Excel nilai, periksa, lalu simpan' },
			{ title: 'Mahasiswa', href: '/app/admin/students', icon: GraduationCap, hint: 'Cari mahasiswa dan buka profil capaiannya' }
		]
	},
	{
		label: 'Mutu',
		items: [
			{ title: 'Laporan', href: '/app/admin/reports', icon: FileText, hint: 'Unduh laporan PDF per kelas' },
			{ title: 'CQI', href: '/app/admin/cqi', icon: ClipboardCheck, hint: 'Catat temuan mutu, tindakan perbaikan, bukti, dan evaluasi' }
		]
	},
	{ label: 'Sistem', items: [{ title: 'Jejak audit', href: '/app/admin/audit', icon: ScrollText, hint: 'Riwayat perubahan data oleh pengguna' }] }
];

const lecturerNavigation: NavGroup[] = [
	{ label: 'Ringkasan', items: [{ title: 'Dashboard dosen', href: '/app/lecturer', icon: LayoutDashboard, hint: 'Kelas yang Anda ampu pada semester aktif', exact: true }] },
	{
		label: 'Pengajaran',
		items: [
			{ title: 'Kelas saya', href: '/app/lecturer/courses', icon: School, hint: 'Kelas, komponen penilaian, dan hasil capaian mahasiswa' },
			{ title: 'Impor nilai', href: '/app/lecturer/import', icon: FileUp, hint: 'Unggah Excel nilai kelas Anda, periksa, lalu simpan' },
			{ title: 'Riwayat impor', href: '/app/lecturer/imports', icon: History, hint: 'Impor yang pernah Anda unggah beserta laporannya' }
		]
	},
	{ label: 'Mutu', items: [{ title: 'Tindak lanjut CQI', href: '/app/lecturer/cqi', icon: ClipboardCheck, hint: 'Temuan mutu yang menjadi tanggung jawab Anda' }] }
];

export function navigationFor(role: AppRole): NavGroup[] {
	return role === appRoles.superAdmin ? adminNavigation : lecturerNavigation;
}

export function isActive(item: NavItem, pathname: string): boolean {
	return item.exact ? pathname === item.href : pathname === item.href || pathname.startsWith(`${item.href}/`);
}

const fallbackTitles: [string, string][] = [
	['/app/students/', 'Profil mahasiswa'],
	['/app/account/profile', 'Profil akun'],
	['/app/account/password', 'Ganti password'],
	['/app/account', 'Akun'],
	['/app/help', 'Panduan istilah']
];

export function pageTitleFor(pathname: string): string | null {
	return fallbackTitles.find(([prefix]) => pathname === prefix.replace(/\/$/, '') || pathname.startsWith(prefix))?.[1] ?? null;
}
