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
    CameraKeyframe // added type import
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

        this.sizes.on('resize', () => this.resize());

        // --- INPUT HANDLING ---
        
        // 1. Mouse Click
        document.addEventListener('mousedown', (event) => {
            this.handleInput(event.clientX, event.clientY, event.target);
        });

        // 2. Mobile Touch
        document.addEventListener('touchstart', (event) => {
            const touch = event.touches[0];
            this.handleInput(touch.clientX, touch.clientY, event.target);
        }, { passive: false });

        this.setPostLoadTransition();
        this.setInstance();
        this.setMonitorListeners();
        this.setFreeCamListeners();
    }

    /**
     * Unified logic for Clicking or Tapping
     */
    handleInput(clientX: number, clientY: number, target: any) {
        // Safety checks
        // @ts-ignore
        if (target.tagName === 'IFRAME') return;
        // @ts-ignore
        if (target.closest('button') || target.closest('a') || target.id === 'prevent-click') return;

        // 1. Coordinates
        this.mouse.x = (clientX / this.sizes.width) * 2 - 1;
        this.mouse.y = -(clientY / this.sizes.height) * 2 + 1;

        // 2. Raycast
        this.raycaster.setFromCamera(this.mouse, this.instance);
        const intersects = this.raycaster.intersectObjects(this.scene.children, true);

        // 3. What did we hit?
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
                name.includes('hitbox') // <--- IMPORTANT: Detects the screen plane
            ) {
                clickedComputer = true;
            }
        }

        // --- NAVIGATION LOGIC ---

        // A. Currently Zoomed In
        if (this.currentKeyframe === CameraKey.MONITOR) {
            if (clickedComputer) return; // Stay focused
            this.trigger('leftMonitor'); // Zoom Out
            return;
        }

        // B. Zoom In
        if (clickedComputer) {
            this.trigger('enterMonitor');
            return;
        }

        // C. Navigate Desk <-> Idle
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
        
        // Clone position to modify it safely
        const targetPos = keyframe.position.clone();

        // (Mobile adjustments are now handled inside the Keyframe classes themselves)

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
        // (Because Monitor/Desk modes now calculate their own mobile offsets)
        if (this.currentKeyframe && this.currentKeyframe !== CameraKey.MONITOR) {
            const keyframe = this.keyframes[this.currentKeyframe];
            this.position.copy(keyframe.position);
            this.focalPoint.copy(keyframe.focalPoint);
        }

        this.instance.position.copy(this.position);
        this.instance.lookAt(this.focalPoint);
    }
}