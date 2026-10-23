export const appRoles = {
	superAdmin: 'super_admin',
	lecturer: 'lecturer'
} as const;

export type AppRole = (typeof appRoles)[keyof typeof appRoles];

export const isAppRole = (value: unknown): value is AppRole => value === appRoles.superAdmin || value === appRoles.lecturer;

export const roleLabels: Record<AppRole, string> = {
	super_admin: 'Super Admin / Kaprodi',
	lecturer: 'Dosen'
};

export const homePathByRole: Record<AppRole, string> = {
	super_admin: '/app/admin',
	lecturer: '/app/lecturer'
};
