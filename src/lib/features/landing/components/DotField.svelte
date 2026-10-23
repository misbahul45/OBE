<script lang="ts">
	import { onMount } from 'svelte';
	import { gsap } from 'gsap';
	import { ScrollTrigger } from 'gsap/ScrollTrigger';
	import { theme } from '#lib/shared/theme/theme.svelte.ts';
	import { buildFormations, dotGridSize } from '../landing.dots.ts';

	type Three = typeof import('three');

	let canvas = $state<HTMLCanvasElement | null>(null);
	let applyColors: (() => void) | null = null;

	const vertexShader = `
		attribute vec3 aGrid;
		attribute vec3 aCluster;
		attribute vec3 aRing;
		attribute vec3 aLoop;
		attribute float aSeed;
		uniform float uStage;
		uniform float uTime;
		uniform float uPixelRatio;
		uniform float uSize;
		uniform float uMotion;
		uniform vec2 uSpan;
		uniform vec2 uPointer;
		varying float vDepth;
		varying float vSeed;
		void main() {
			float s = clamp(uStage, 0.0, 3.0);
			float from = floor(min(s, 2.999));
			float mixer = smoothstep(0.0, 1.0, s - from);
			float shape = min(uSpan.x, uSpan.y) * 1.25;
			vec3 gridPos = vec3(aGrid.x * uSpan.x, aGrid.y * uSpan.y, 0.0);
			vec3 clusterPos = aCluster * shape;
			vec3 ringPos = aRing * shape;
			vec3 loopPos = aLoop * shape;
			vec3 a = from < 0.5 ? gridPos : (from < 1.5 ? clusterPos : ringPos);
			vec3 b = from < 0.5 ? clusterPos : (from < 1.5 ? ringPos : loopPos);
			vec3 p = mix(a, b, mixer);
			float spin = uTime * 0.12 * smoothstep(2.0, 3.0, s) * uMotion;
			p.xy = mat2(cos(spin), -sin(spin), sin(spin), cos(spin)) * p.xy;
			float wave = sin(p.x * 1.6 + uTime * 0.7 * uMotion + aSeed * 6.2831) * cos(p.y * 1.3 + uTime * 0.5 * uMotion);
			p.z += wave * 0.16 * (1.0 - smoothstep(0.0, 1.0, s));
			p.z += sin(uTime * 0.6 * uMotion + aSeed * 12.566) * 0.04;
			vec2 away = p.xy - uPointer * uSpan;
			float reach = exp(-dot(away, away) * 1.4) * uMotion;
			p.xy += normalize(away + 0.0001) * reach * 0.22;
			p.z += reach * 0.35;
			vec4 mv = modelViewMatrix * vec4(p, 1.0);
			gl_Position = projectionMatrix * mv;
			gl_PointSize = uSize * uPixelRatio * (4.0 / -mv.z) * (1.0 + reach * 1.8) * (0.75 + aSeed * 0.5);
			vDepth = clamp(0.5 + p.z * 0.9, 0.0, 1.0);
			vSeed = aSeed;
		}
	`;

	const fragmentShader = `
		uniform vec3 uPrimary;
		uniform vec3 uMuted;
		uniform float uOpacity;
		varying float vDepth;
		varying float vSeed;
		void main() {
			float d = length(gl_PointCoord - 0.5);
			if (d > 0.5) discard;
			float edge = smoothstep(0.5, 0.32, d);
			vec3 color = mix(uMuted, uPrimary, clamp(vDepth * 0.9 + vSeed * 0.3, 0.0, 1.0));
			gl_FragColor = vec4(color, edge * uOpacity * (0.45 + vDepth * 0.55));
		}
	`;

	const webglAvailable = () => {
		try {
			const probe = document.createElement('canvas');
			return Boolean(probe.getContext('webgl2') ?? probe.getContext('webgl'));
		} catch {
			return false;
		}
	};

	onMount(() => {
		const element = canvas;
		if (!element || !webglAvailable()) return;
		const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		let disposed = false;
		let teardown: (() => void) | null = null;

		(async () => {
			const THREE: Three = await import('three');
			if (disposed) return;

			const width = () => Math.max(1, window.innerWidth);
			const height = () => Math.max(1, window.innerHeight);
			const { columns, rows } = dotGridSize(width(), height(), width() < 640 ? 30 : 24);
			const formations = buildFormations(columns, rows);

			const renderer = new THREE.WebGLRenderer({ canvas: element, alpha: true, antialias: false, powerPreference: 'low-power' });
			renderer.setClearColor(0x000000, 0);
			const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
			renderer.setPixelRatio(pixelRatio);

			const scene = new THREE.Scene();
			const camera = new THREE.PerspectiveCamera(45, width() / height(), 0.1, 50);
			camera.position.z = 4;
			const halfHeight = Math.tan((45 * Math.PI) / 360) * camera.position.z;

			const geometry = new THREE.BufferGeometry();
			const placeholder = new THREE.BufferAttribute(new Float32Array(formations.count * 3), 3);
			geometry.setAttribute('position', placeholder);
			geometry.setAttribute('aGrid', new THREE.BufferAttribute(formations.stages[0], 3));
			geometry.setAttribute('aCluster', new THREE.BufferAttribute(formations.stages[1], 3));
			geometry.setAttribute('aRing', new THREE.BufferAttribute(formations.stages[2], 3));
			geometry.setAttribute('aLoop', new THREE.BufferAttribute(formations.stages[3], 3));
			geometry.setAttribute('aSeed', new THREE.BufferAttribute(formations.seeds, 1));

			const uniforms = {
				uStage: { value: 0 },
				uTime: { value: 0 },
				uPixelRatio: { value: pixelRatio },
				uSize: { value: width() < 640 ? 3 : 3.6 },
				uMotion: { value: reduced ? 0 : 1 },
				uSpan: { value: new THREE.Vector2(halfHeight * (width() / height()) * 1.04, halfHeight * 1.04) },
				uPointer: { value: new THREE.Vector2(9, 9) },
				uPrimary: { value: new THREE.Color('#2563eb') },
				uMuted: { value: new THREE.Color('#94a3b8') },
				uOpacity: { value: 0 }
			};

			const material = new THREE.ShaderMaterial({ uniforms, vertexShader, fragmentShader, transparent: true, depthWrite: false });
			const points = new THREE.Points(geometry, material);
			points.frustumCulled = false;
			scene.add(points);

			applyColors = () => {
				const style = getComputedStyle(document.documentElement);
				uniforms.uPrimary.value.set(style.getPropertyValue('--primary').trim() || '#2563eb');
				uniforms.uMuted.value.set(style.getPropertyValue('--muted-foreground').trim() || '#94a3b8');
				if (reduced) draw();
			};

			const draw = () => renderer.render(scene, camera);

			const resize = () => {
				renderer.setSize(width(), height(), false);
				camera.aspect = width() / height();
				camera.updateProjectionMatrix();
				uniforms.uSpan.value.set(halfHeight * camera.aspect * 1.04, halfHeight * 1.04);
				uniforms.uSize.value = width() < 640 ? 3 : 3.6;
				if (reduced) draw();
			};
			resize();
			applyColors();

			const pointer = { x: 9, y: 9 };
			const onPointer = (event: PointerEvent) => {
				pointer.x = (event.clientX / width()) * 2 - 1;
				pointer.y = -((event.clientY / height()) * 2 - 1);
			};
			const onLeave = () => {
				pointer.x = 9;
				pointer.y = 9;
			};

			const context = gsap.context(() => {
				gsap.to(uniforms.uOpacity, { value: reduced ? 0.55 : 0.8, duration: reduced ? 0 : 1.6, ease: 'power2.out', onUpdate: reduced ? draw : undefined });
				if (reduced) return;

				gsap.registerPlugin(ScrollTrigger);
				const stages = gsap.utils.toArray<HTMLElement>('[data-dot-stage]');
				for (const stage of stages) {
					const target = Number(stage.dataset.dotStage);
					ScrollTrigger.create({
						trigger: stage,
						start: 'top 62%',
						end: 'bottom 38%',
						onToggle: (self) => {
							if (self.isActive) gsap.to(uniforms.uStage, { value: target, duration: 1.6, ease: 'power3.inOut', overwrite: 'auto' });
						}
					});
				}
			});

			const tick = (_time: number, delta: number) => {
				uniforms.uTime.value += delta / 1000;
				uniforms.uPointer.value.x += (pointer.x - uniforms.uPointer.value.x) * 0.12;
				uniforms.uPointer.value.y += (pointer.y - uniforms.uPointer.value.y) * 0.12;
				draw();
			};

			window.addEventListener('resize', resize);
			if (!reduced) {
				window.addEventListener('pointermove', onPointer, { passive: true });
				document.documentElement.addEventListener('pointerleave', onLeave);
				gsap.ticker.add(tick);
			} else {
				draw();
			}

			teardown = () => {
				window.removeEventListener('resize', resize);
				window.removeEventListener('pointermove', onPointer);
				document.documentElement.removeEventListener('pointerleave', onLeave);
				gsap.ticker.remove(tick);
				context.revert();
				applyColors = null;
				geometry.dispose();
				material.dispose();
				renderer.dispose();
				renderer.forceContextLoss();
			};
		})();

		return () => {
			disposed = true;
			teardown?.();
		};
	});

	$effect(() => {
		void theme.resolved;
		applyColors?.();
	});
</script>

<canvas bind:this={canvas} aria-hidden="true" class="pointer-events-none fixed inset-0 z-0 h-full w-full" data-dot-field></canvas>
