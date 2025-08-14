"use client";

import { Canvas, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useState } from "react";
import { useSidebar } from "../ui/sidebar";
import { cn } from "~/lib/utils";

function StarfieldMaterial() {
	const materialRef = useRef<THREE.ShaderMaterial>(null);

	const uniforms = useMemo(
		() => ({
			uTime: { value: 0 },
			uResolution: { value: new THREE.Vector2() },
		}),
		[],
	);

	const vertexShader = `
		attribute float size;
		attribute vec3 customColor;
		varying vec3 vColor;
		uniform float uTime;
		
		void main() {
			vColor = customColor;
			vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
			
			// Subtle star motion
			mvPosition.x += sin(uTime * 0.5 + position.y * 0.01) * 0.1;
			mvPosition.y += cos(uTime * 0.3 + position.x * 0.01) * 0.1;
			
			gl_PointSize = size * (300.0 / -mvPosition.z);
			gl_Position = projectionMatrix * mvPosition;
		}
	`;

	const fragmentShader = `
		varying vec3 vColor;
		uniform float uTime;
		
		void main() {
			float d = distance(gl_PointCoord, vec2(0.5));
			float strength = 0.05 / d - 0.1;
			float twinkle = sin(uTime * 2.0 + gl_FragCoord.x * 0.01 + gl_FragCoord.y * 0.01) * 0.5 + 0.5;
			strength *= (0.7 + twinkle * 0.3);
			gl_FragColor = vec4(vColor, strength);
		}
	`;

	useFrame((state) => {
		if (materialRef.current?.uniforms?.uTime) {
			materialRef.current.uniforms.uTime.value = state.clock.getElapsedTime();
		}
	});

	return (
		<shaderMaterial
			ref={materialRef}
			uniforms={uniforms}
			vertexShader={vertexShader}
			fragmentShader={fragmentShader}
			transparent
			depthWrite={false}
			blending={THREE.AdditiveBlending}
		/>
	);
}

function Starfield() {
	const pointsRef = useRef<THREE.Points>(null);

	const [positions, colors, sizes] = useMemo(() => {
		const count = 1400; // slightly reduced for perf
		const positions = new Float32Array(count * 3);
		const colors = new Float32Array(count * 3);
		const sizes = new Float32Array(count);

		for (let i = 0; i < count; i++) {
			const radius = Math.random() * 100 + 50;
			const theta = Math.random() * Math.PI * 2;
			const phi = Math.acos(Math.random() * 2 - 1);

			positions[i * 3] = radius * Math.sin(phi) * Math.cos(theta);
			positions[i * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
			positions[i * 3 + 2] = radius * Math.cos(phi);

			const intensity = Math.random() * 0.5 + 0.5;
			colors[i * 3] = intensity;
			colors[i * 3 + 1] = intensity * (0.8 + Math.random() * 0.2);
			colors[i * 3 + 2] = intensity * (0.9 + Math.random() * 0.1);

			sizes[i] = Math.random() * 3 + 1;
		}

		return [positions, colors, sizes];
	}, []);

	useFrame((state) => {
		if (pointsRef.current) {
			pointsRef.current.rotation.y = state.clock.elapsedTime * 0.02;
			pointsRef.current.rotation.x = Math.sin(state.clock.elapsedTime * 0.01) * 0.1;
		}
	});

	return (
		<points ref={pointsRef}>
			<bufferGeometry>
				<bufferAttribute attach="attributes-position" args={[positions, 3]} />
				<bufferAttribute attach="attributes-customColor" args={[colors, 3]} />
				<bufferAttribute attach="attributes-size" args={[sizes, 1]} />
			</bufferGeometry>
			<StarfieldMaterial />
		</points>
	);
}

export function BackgroundSpace() {
	const [fogColor, setFogColor] = useState<string>("#0a0a0f");

	useEffect(() => {
		if (typeof window === "undefined") return;
		const compute = () => {
			const bg = getComputedStyle(document.documentElement)
				.getPropertyValue("--background")
				.trim() || "#0a0a0f";
			setFogColor(bg);
		};
		compute();
		const observer = new MutationObserver(compute);
		observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
		return () => observer.disconnect();
	}, []);

	const { state } = useSidebar();
	const collapsed = state === "collapsed";

	return (
		<div className={cn("fixed -z-10 will-change-transform pointer-events-none bg-background", collapsed ? "inset-0" : "mt-2 w-full h-full rounded-t-xl")}>
			<Canvas
				className="[transform:translateZ(0)] rounded-t-3xl"
				camera={{ position: [0, 0, 0], fov: 75 }}
				dpr={[1, 1.75]}
				frameloop="always"
				resize={{ scroll: false }}
				gl={{ antialias: true, alpha: true, powerPreference: "high-performance" }}
			>
				<ambientLight intensity={0.1} />
				<Starfield />
				<fog attach="fog" args={[fogColor, 50, 200]} />
			</Canvas>
		</div>
	);
}


