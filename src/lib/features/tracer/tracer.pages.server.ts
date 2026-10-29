import type { Database } from '#lib/shared/db/client.server.ts';
import { pageParam, runAction } from '#lib/shared/http/action.server.ts';
import { requireRole } from '#lib/features/auth/index.server.ts';
import type { SessionUser } from '#lib/features/auth/index.ts';
import { getTracerOverview, tracerPageSizes } from './tracer.queries.server.ts';
import { clearTracerRecord, saveTracerRecord } from './tracer.service.server.ts';
import type { TracerStatusFilter } from './tracer.types.ts';

type Locals = { user: SessionUser | null };

const statusOf = (value: string | null): TracerStatusFilter | undefined => (value === 'belum' || value === 'linear' || value === 'tidak' ? value : undefined);

export async function tracerLoad(db: Database, { locals, url }: { locals: Locals; url: URL }) {
	requireRole(locals, 'super_admin');
	const search = url.searchParams.get('cari')?.trim() ?? '';
	const status = statusOf(url.searchParams.get('status'));
	const size = Number(url.searchParams.get('ukuran'));
	const overview = await getTracerOverview(db, { search: search || undefined, status, page: pageParam(url), pageSize: tracerPageSizes.find((s) => s === size) });
	return { ...overview, query: { search, status: status ?? '', pageSize: overview.pageSize } };
}

export function tracerActions(db: Database) {
	return {
		save: async ({ request, locals }: { request: Request; locals: Locals }) => {
			const user = requireRole(locals, 'super_admin');
			const data = await request.formData();
			const result = await runAction(() =>
				saveTracerRecord(db, { id: user.id, role: user.role }, {
					studentId: String(data.get('studentId') ?? ''),
					linear: String(data.get('linear') ?? ''),
					careerFieldCode: String(data.get('careerFieldCode') ?? ''),
					keeratan: String(data.get('keeratan') ?? ''),
					note: String(data.get('note') ?? '')
				})
			);
			return result.ok ? { success: result.value.created ? 'Data tracer disimpan.' : 'Data tracer diperbarui.' } : result.failure;
		},
		clear: async ({ request, locals }: { request: Request; locals: Locals }) => {
			const user = requireRole(locals, 'super_admin');
			const data = await request.formData();
			const result = await runAction(() => clearTracerRecord(db, { id: user.id, role: user.role }, String(data.get('studentId') ?? '')));
			return result.ok ? { success: result.value.removed ? 'Data tracer dihapus.' : 'Tidak ada data tracer untuk dihapus.' } : result.failure;
		}
	};
}
