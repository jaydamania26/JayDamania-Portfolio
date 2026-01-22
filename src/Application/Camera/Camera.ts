import * as THREE from 'three';
import Application from '../Application';
import Sizes from '../Utils/Sizes';
import EventEmitter from '../Utils/EventEmitter';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls';
import TWEEN from '@tweenjs/tween.js';
import Renderer from '../Renderer';
import Resources from '../Utils/Resources';
import UIEventBus from '../UI/EventBus';
import Time from '../Utils/Time';
import BezierEasing from 'bezier-easing';
import {
    CameraKeyframeInstance,
    MonitorKeyframe,
    IdleKeyframe,
    LoadingKeyframe,
    DeskKeyframe,
    OrbitControlsStart,
} from './CameraKeyframes';

export enum CameraKey {
    IDLE = 'idle',
    MONITOR = 'monitor',
    LOADING = 'loading',
    DESK = 'desk',
    ORBIT_CONTROLS_START = 'orbitControlsStart',
}

export default class Camera extends EventEmitter {
    application: Application;
    sizes: Sizes;
    scene: THREE.Scene;
    instance: THREE.PerspectiveCamera;
    renderer: Renderer;
    resources: Resources;
    time: Time;

    position: THREE.Vector3;
    focalPoint: THREE.Vector3;

    freeCam: boolean;
    orbitControls: OrbitControls;

    currentKeyframe: CameraKey | undefined;
    targetKeyframe: CameraKey | undefined;
    keyframes: { [key in CameraKey]: CameraKeyframeInstance };

    raycaster: THREE.Raycaster;
    mouse: THREE.Vector2;

    constructor() {
        super();
        this.application = new Application();
        this.sizes = this.application.sizes;
        this.scene = this.application.scene;
        this.renderer = this.application.renderer;
        this.resources = this.application.resources;
        this.time = this.application.time;

        this.position = new THREE.Vector3(0, 0, 0);
        this.focalPoint = new THREE.Vector3(0, 0, 0);

        this.freeCam = false;

        this.raycaster = new THREE.Raycaster();
        this.mouse = new THREE.Vector2();

        this.keyframes = {
            idle: new IdleKeyframe(),
            monitor: new MonitorKeyframe(),
            loading: new LoadingKeyframe(),
            desk: new DeskKeyframe(),
            orbitControlsStart: new OrbitControlsStart(),
        };

        // Listen for Resize to adjust Mobile View dynamically
        this.sizes.on('resize', () => this.resize());

        // --- INPUT HANDLING (MOUSE & TOUCH) ---
        
        // Desktop Click
        document.addEventListener('mousedown', (event) => {
            this.handleInput(event.clientX, event.clientY, event.target);
        });

        // Mobile Touch Listener
        document.addEventListener('touchstart', (event) => {
            const touch = event.touches[0];
            // Pass the target so we can check if it's the Blocker
            this.handleInput(touch.clientX, touch.clientY, event.target);
        }, { passive: false });
    }

    /**
     * Unified Input Handler for Mouse and Touch
     */
// ... update the handleInput function ...

    handleInput(clientX: number, clientY: number, target: any) {
        // @ts-ignore
        if (target.tagName === 'IFRAME') return;
        // @ts-ignore
        if (target.closest('button') || target.closest('a') || target.id === 'prevent-click') return;

        // 1. Calculate Coordinates
        this.mouse.x = (clientX / this.sizes.width) * 2 - 1;
        this.mouse.y = -(clientY / this.sizes.height) * 2 + 1;

        // 2. Raycast
        this.raycaster.setFromCamera(this.mouse, this.instance);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // 3. Check for Computer OR The Screen Hitbox
        let clickedComputer = false;

        if (intersects.length > 0) {
            const object = intersects[0].object;
            const name = object.name.toLowerCase();

            if (
                name.includes('computer') || 
                name.includes('monitor') || 
                name.includes('screen') || 
                name.includes('display') || 
                name.includes('pc') ||
                name.includes('glass') ||
                name.includes('bezel') ||
                name.includes('stand') ||
                name.includes('hitbox') // <--- This detects the invisible plane now
            ) {
                clickedComputer = true;
            }
        }

        // ... rest of the logic (A, B, C) remains the same ...
        // A: Currently Zoomed In
        if (this.currentKeyframe === CameraKey.MONITOR) {
            if (clickedComputer) return; 
            this.trigger('leftMonitor'); 
            return;
        }
        // B: Zoom In
        if (clickedComputer) {
            this.trigger('enterMonitor');
            return;
        }

        // C: Navigation (Idle <-> Desk)
        if (
            this.currentKeyframe === CameraKey.IDLE ||
            this.targetKeyframe === CameraKey.IDLE
        ) {
            this.transition(CameraKey.DESK);
        } else if (
            this.currentKeyframe === CameraKey.DESK ||
            this.targetKeyframe === CameraKey.DESK
        ) {
            this.transition(CameraKey.IDLE);
        }
    }

    /**
     * Helper to check if device is mobile based on width
     */
    isMobile() {
        return this.sizes.width < 768; // Standard tablet/mobile breakpoint
    }

    /**
     * Adjusts the Monitor Position based on screen width
     */
    getMonitorPosition() {
        const originalPos = this.keyframes.monitor.position.clone();
        
        if (this.isMobile()) {
            // ON MOBILE: Move camera BACK (increase Z) so the screen fits
            // You might need to tweak the '600' value depending on your scene scale
            originalPos.z += 600; 
            originalPos.y -= 50; // Optional: Adjust height slightly
        }
        
        return originalPos;
    }

    transition(
        key: CameraKey,
        duration: number = 1000,
        easing?: any,
        callback?: () => void
    ) {
        if (this.currentKeyframe === key) return;

        if (this.targetKeyframe) TWEEN.removeAll();

        this.currentKeyframe = undefined;
        this.targetKeyframe = key;

        const keyframe = this.keyframes[key];
        
        // DETERMINE TARGET POSITION
        let targetPos = keyframe.position.clone();

        // If going to MONITOR, calculate mobile offset
        if (key === CameraKey.MONITOR) {
            targetPos = this.getMonitorPosition();
        }

        const posTween = new TWEEN.Tween(this.position)
            .to(targetPos, duration)
            .easing(easing || TWEEN.Easing.Quintic.InOut)
            .onComplete(() => {
                this.currentKeyframe = key;
                this.targetKeyframe = undefined;
                if (callback) callback();
            });

        const focTween = new TWEEN.Tween(this.focalPoint)
            .to(keyframe.focalPoint, duration)
            .easing(easing || TWEEN.Easing.Quintic.InOut);

        posTween.start();
        focTween.start();
    }

    setInstance() {
        this.instance = new THREE.PerspectiveCamera(
            35,
            this.sizes.width / this.sizes.height,
            10,
            900000
        );
        this.currentKeyframe = CameraKey.LOADING;
        this.scene.add(this.instance);
    }

    setMonitorListeners() {
        this.on('enterMonitor', () => {
            if (this.currentKeyframe === CameraKey.MONITOR) return;
            
            this.transition(
                CameraKey.MONITOR,
                2000,
                BezierEasing(0.13, 0.99, 0, 1)
            );
            UIEventBus.dispatch('enterMonitor', {});
        });

        this.on('leftMonitor', () => {
            if (this.currentKeyframe === CameraKey.DESK) return;

            this.transition(CameraKey.DESK);
            UIEventBus.dispatch('leftMonitor', {});
        });
    }

    // ... (Keep setFreeCamListeners, setPostLoadTransition, createControls as they were)
    setFreeCamListeners() {
        UIEventBus.on('freeCamToggle', (toggle: boolean) => {
            if (toggle) {
                this.transition(
                    CameraKey.ORBIT_CONTROLS_START,
                    750,
                    BezierEasing(0.13, 0.99, 0, 1),
                    () => {
                        this.instance.position.copy(this.keyframes.orbitControlsStart.position);
                        this.orbitControls.update();
                        this.freeCam = true;
                    }
                );
                // @ts-ignore
                document.getElementById('webgl').style.pointerEvents = 'auto';
            } else {
                this.freeCam = false;
                this.transition(CameraKey.IDLE, 4000, TWEEN.Easing.Exponential.Out);
                // @ts-ignore
                document.getElementById('webgl').style.pointerEvents = 'none';
            }
        });
    }

    setPostLoadTransition() {
        UIEventBus.on('loadingScreenDone', () => {
            this.transition(CameraKey.IDLE, 2500, TWEEN.Easing.Exponential.Out);
        });
    }

    createControls() {
        this.renderer = this.application.renderer;
        this.orbitControls = new OrbitControls(this.instance, this.renderer.instance.domElement);
        const { x, y, z } = this.keyframes.orbitControlsStart.focalPoint;
        this.orbitControls.target.set(x, y, z);
        this.orbitControls.enablePan = false;
        this.orbitControls.enableDamping = true;
        this.orbitControls.object.position.copy(this.keyframes.orbitControlsStart.position);
        this.orbitControls.dampingFactor = 0.05;
        this.orbitControls.maxPolarAngle = Math.PI / 2;
        this.orbitControls.minDistance = 4000;
        this.orbitControls.maxDistance = 29000;
        this.orbitControls.update();
    }

    resize() {
        this.instance.aspect = this.sizes.width / this.sizes.height;
        this.instance.updateProjectionMatrix();

        // If we are currently looking at the monitor and the window resizes (e.g., rotation),
        // adjust the camera position immediately
        if (this.currentKeyframe === CameraKey.MONITOR) {
            const targetPos = this.getMonitorPosition();
            // Smoothly move to new adjustment or snap
            new TWEEN.Tween(this.position)
                .to(targetPos, 500)
                .easing(TWEEN.Easing.Quadratic.Out)
                .start();
        }
    }

    update() {
        TWEEN.update();

        if (this.freeCam && this.orbitControls) {
            this.position.copy(this.orbitControls.object.position);
            this.focalPoint.copy(this.orbitControls.target);
            this.orbitControls.update();
            return;
        }

        for (const key in this.keyframes) {
            const _key = key as CameraKey;
            this.keyframes[_key].update();
        }

        // Only force position from keyframe if NOT in Monitor mode
        // (Because Monitor mode now calculates its own mobile offset)
        if (this.currentKeyframe && this.currentKeyframe !== CameraKey.MONITOR) {
            const keyframe = this.keyframes[this.currentKeyframe];
            this.position.copy(keyframe.position);
            this.focalPoint.copy(keyframe.focalPoint);
        }

        this.instance.position.copy(this.position);
        this.instance.lookAt(this.focalPoint);
    }
}