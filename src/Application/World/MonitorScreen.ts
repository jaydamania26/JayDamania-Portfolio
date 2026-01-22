import * as THREE from 'three';
import { CSS3DObject } from 'three/examples/jsm/renderers/CSS3DRenderer.js';
import GUI from 'lil-gui';
import Application from '../Application';
import Debug from '../Utils/Debug';
import Resources from '../Utils/Resources';
import Sizes from '../Utils/Sizes';
import Camera from '../Camera/Camera';
import EventEmitter from '../Utils/EventEmitter';
import UIEventBus from '../UI/EventBus'; // <--- MAKE SURE THIS PATH IS CORRECT

const SCREEN_SIZE = { w: 1280, h: 1024 };
const IFRAME_PADDING = 32;
const IFRAME_SIZE = {
    w: SCREEN_SIZE.w - IFRAME_PADDING,
    h: SCREEN_SIZE.h - IFRAME_PADDING,
};

export default class MonitorScreen extends EventEmitter {
    application: Application;
    scene: THREE.Scene;
    cssScene: THREE.Scene;
    resources: Resources;
    debug: Debug;
    sizes: Sizes;
    debugFolder: GUI;
    screenSize: THREE.Vector2;
    position: THREE.Vector3;
    rotation: THREE.Euler;
    camera: Camera;
    prevInComputer: boolean;
    shouldLeaveMonitor: boolean;
    inComputer: boolean;
    mouseClickInProgress: boolean;
    dimmingPlane: THREE.Mesh;
    videoTextures: { [key in string]: THREE.VideoTexture };
    
    // NEW: Reference to the blocker div
    blocker: HTMLDivElement;

    constructor() {
        super();
        this.application = new Application();
        this.scene = this.application.scene;
        this.cssScene = this.application.cssScene;
        this.sizes = this.application.sizes;
        this.resources = this.application.resources;
        this.screenSize = new THREE.Vector2(SCREEN_SIZE.w, SCREEN_SIZE.h);
        this.camera = this.application.camera;
        this.position = new THREE.Vector3(0, 950, 255);
        this.rotation = new THREE.Euler(-3 * THREE.MathUtils.DEG2RAD, 0, 0);
        this.videoTextures = {};
        this.mouseClickInProgress = false;
        this.shouldLeaveMonitor = false;

        // Create screen
        this.createIframe(); // This now creates the blocker too
        const maxOffset = this.createTextureLayers();
        this.createEnclosingPlanes(maxOffset);
        this.createPerspectiveDimmer(maxOffset);
        
        // Initialize Events
        this.initializeScreenEvents();
        this.setupBlockerEvents(); // <--- NEW Function
    }

    // NEW: Handle showing/hiding the click blocker
    setupBlockerEvents() {
        // When we Zoom In -> Hide blocker (so we can use the website)
        UIEventBus.on('enterMonitor', () => {
            if (this.blocker) this.blocker.style.pointerEvents = 'none';
        });

        // When we Zoom Out -> Show blocker (so we can click to zoom in again)
        UIEventBus.on('leftMonitor', () => {
            if (this.blocker) this.blocker.style.pointerEvents = 'auto';
        });
    }

    initializeScreenEvents() {
        // Kept for legacy support, but the Blocker handles the main "Enter" logic now
        document.addEventListener(
            'mousemove',
            (event) => {
                // @ts-ignore
                const id = event.target.id;
                if (id === 'computer-screen') {
                    // @ts-ignore
                    event.inComputer = true;
                }
                // @ts-ignore
                this.inComputer = event.inComputer;
                this.application.mouse.trigger('mousemove', [event]);
                this.prevInComputer = this.inComputer;
            },
            false
        );
        // We still forward mousedown events for the computer interaction
        document.addEventListener(
            'mousedown',
            (event) => {
                // @ts-ignore
                this.inComputer = event.inComputer;
                this.application.mouse.trigger('mousedown', [event]);
                this.mouseClickInProgress = true;
                this.prevInComputer = this.inComputer;
            },
            false
        );
        document.addEventListener(
            'mouseup',
            (event) => {
                // @ts-ignore
                this.inComputer = event.inComputer;
                this.application.mouse.trigger('mouseup', [event]);
                this.mouseClickInProgress = false;
                this.prevInComputer = this.inComputer;
            },
            false
        );
    }

    createIframe() {
        // Create container
        const container = document.createElement('div');
        container.style.width = this.screenSize.width + 'px';
        container.style.height = this.screenSize.height + 'px';
        container.style.opacity = '1';
        container.style.background = '#1d2e2f';
        // IMPORTANT: Relative position allows us to stack the blocker on top
        container.style.position = 'relative'; 

        // Create iframe
        const iframe = document.createElement('iframe');

        iframe.onload = () => {
            if (iframe.contentWindow) {
                window.addEventListener('message', (event) => {
                    var evt = new CustomEvent(event.data.type, {
                        bubbles: true,
                        cancelable: false,
                    });
                    // @ts-ignore
                    evt.inComputer = true;
                    if (event.data.type === 'mousemove') {
                        var clRect = iframe.getBoundingClientRect();
                        const { top, left, width, height } = clRect;
                        const widthRatio = width / IFRAME_SIZE.w;
                        const heightRatio = height / IFRAME_SIZE.h;
                        // @ts-ignore
                        evt.clientX = Math.round(event.data.clientX * widthRatio + left);
                        //@ts-ignore
                        evt.clientY = Math.round(event.data.clientY * heightRatio + top);
                    } else if (event.data.type === 'keydown') {
                        // @ts-ignore
                        evt.key = event.data.key;
                    } else if (event.data.type === 'keyup') {
                        // @ts-ignore
                        evt.key = event.data.key;
                    }
                    iframe.dispatchEvent(evt);
                });
            }
        };

        iframe.src = 'https://inner-site-green.vercel.app/';
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.has('dev')) {
            iframe.src = 'http://localhost:8000/';
        }
        iframe.style.width = this.screenSize.width + 'px';
        iframe.style.height = this.screenSize.height + 'px';
        iframe.style.padding = IFRAME_PADDING + 'px';
        iframe.style.boxSizing = 'border-box';
        iframe.style.opacity = '1';
        iframe.className = 'jitter';
        iframe.id = 'computer-screen';
        iframe.frameBorder = '0';
        iframe.title = 'DamaniaOS';

        // Add iframe to container
        container.appendChild(iframe);

        // --- NEW: BLOCKER DIV ---
        // This transparent div sits on top of the iframe. 
        // When clicked, it tells the camera to Zoom In.
        const blocker = document.createElement('div');
        blocker.style.position = 'absolute';
        blocker.style.top = '0';
        blocker.style.left = '0';
        blocker.style.width = '100%';
        blocker.style.height = '100%';
        blocker.style.zIndex = '10'; // Higher than iframe
        blocker.style.cursor = 'pointer'; // Show pointer so user knows to click
        
        // When clicked: Trigger Zoom In
        blocker.onclick = () => {
            this.camera.trigger('enterMonitor');
        };

        this.blocker = blocker;
        container.appendChild(blocker);
        // ------------------------

        // Create CSS plane
        this.createCssPlane(container);
    }

    createCssPlane(element: HTMLElement) {
        const object = new CSS3DObject(element);
        object.position.copy(this.position);
        object.rotation.copy(this.rotation);
        this.cssScene.add(object);

        const material = new THREE.MeshLambertMaterial();
        material.side = THREE.DoubleSide;
        material.opacity = 0;
        material.transparent = true;
        material.blending = THREE.NoBlending;

        const geometry = new THREE.PlaneGeometry(
            this.screenSize.width,
            this.screenSize.height
        );

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(object.position);
        mesh.rotation.copy(object.rotation);
        mesh.scale.copy(object.scale);

        this.scene.add(mesh);
    }

    // ... (Keep existing createTextureLayers, getVideoTextures, addTextureLayer, createEnclosingPlanes, createEnclosingPlane, createPerspectiveDimmer, offsetPosition, update)
    createTextureLayers() {
        const textures = this.resources.items.texture;
        this.getVideoTextures('video-1');
        this.getVideoTextures('video-2');

        const scaleFactor = 4;
        const layers = {
            smudge: {
                texture: textures.monitorSmudgeTexture,
                blending: THREE.AdditiveBlending,
                opacity: 0.12,
                offset: 24,
            },
            innerShadow: {
                texture: textures.monitorShadowTexture,
                blending: THREE.NormalBlending,
                opacity: 1,
                offset: 5,
            },
            video: {
                texture: this.videoTextures['video-1'],
                blending: THREE.AdditiveBlending,
                opacity: 0.5,
                offset: 10,
            },
            video2: {
                texture: this.videoTextures['video-2'],
                blending: THREE.AdditiveBlending,
                opacity: 0.1,
                offset: 15,
            },
        };

        let maxOffset = -1;
        for (const [_, layer] of Object.entries(layers)) {
            const offset = layer.offset * scaleFactor;
            this.addTextureLayer(
                layer.texture,
                layer.blending,
                layer.opacity,
                offset
            );
            if (offset > maxOffset) maxOffset = offset;
        }
        return maxOffset;
    }

    getVideoTextures(videoId: string) {
        const video = document.getElementById(videoId);
        if (!video) {
            setTimeout(() => {
                this.getVideoTextures(videoId);
            }, 100);
        } else {
            this.videoTextures[videoId] = new THREE.VideoTexture(
                video as HTMLVideoElement
            );
        }
    }

    addTextureLayer(
        texture: THREE.Texture,
        blendingMode: THREE.Blending,
        opacity: number,
        offset: number
    ) {
        const material = new THREE.MeshBasicMaterial({
            map: texture,
            blending: blendingMode,
            side: THREE.DoubleSide,
            opacity,
            transparent: true,
        });

        const geometry = new THREE.PlaneGeometry(
            this.screenSize.width,
            this.screenSize.height
        );

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(
            this.offsetPosition(this.position, new THREE.Vector3(0, 0, offset))
        );
        mesh.rotation.copy(this.rotation);
        this.scene.add(mesh);
    }

    createEnclosingPlanes(maxOffset: number) {
        const planes = {
            left: {
                size: new THREE.Vector2(maxOffset, this.screenSize.height),
                position: this.offsetPosition(
                    this.position,
                    new THREE.Vector3(
                        -this.screenSize.width / 2,
                        0,
                        maxOffset / 2
                    )
                ),
                rotation: new THREE.Euler(0, 90 * THREE.MathUtils.DEG2RAD, 0),
            },
            right: {
                size: new THREE.Vector2(maxOffset, this.screenSize.height),
                position: this.offsetPosition(
                    this.position,
                    new THREE.Vector3(
                        this.screenSize.width / 2,
                        0,
                        maxOffset / 2
                    )
                ),
                rotation: new THREE.Euler(0, 90 * THREE.MathUtils.DEG2RAD, 0),
            },
            top: {
                size: new THREE.Vector2(this.screenSize.width, maxOffset),
                position: this.offsetPosition(
                    this.position,
                    new THREE.Vector3(
                        0,
                        this.screenSize.height / 2,
                        maxOffset / 2
                    )
                ),
                rotation: new THREE.Euler(90 * THREE.MathUtils.DEG2RAD, 0, 0),
            },
            bottom: {
                size: new THREE.Vector2(this.screenSize.width, maxOffset),
                position: this.offsetPosition(
                    this.position,
                    new THREE.Vector3(
                        0,
                        -this.screenSize.height / 2,
                        maxOffset / 2
                    )
                ),
                rotation: new THREE.Euler(90 * THREE.MathUtils.DEG2RAD, 0, 0),
            },
        };

        for (const [_, plane] of Object.entries(planes)) {
            this.createEnclosingPlane(plane);
        }
    }

    createEnclosingPlane(plane: EnclosingPlane) {
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            color: 0x48493f,
        });

        const geometry = new THREE.PlaneGeometry(plane.size.x, plane.size.y);
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.copy(plane.position);
        mesh.rotation.copy(plane.rotation);
        this.scene.add(mesh);
    }

    createPerspectiveDimmer(maxOffset: number) {
        const material = new THREE.MeshBasicMaterial({
            side: THREE.DoubleSide,
            color: 0x000000,
            transparent: true,
            blending: THREE.AdditiveBlending,
        });

        const plane = new THREE.PlaneGeometry(
            this.screenSize.width,
            this.screenSize.height
        );

        const mesh = new THREE.Mesh(plane, material);
        mesh.position.copy(
            this.offsetPosition(
                this.position,
                new THREE.Vector3(0, 0, maxOffset - 5)
            )
        );
        mesh.rotation.copy(this.rotation);
        this.dimmingPlane = mesh;
        this.scene.add(mesh);
    }

    offsetPosition(position: THREE.Vector3, offset: THREE.Vector3) {
        const newPosition = new THREE.Vector3();
        newPosition.copy(position);
        newPosition.add(offset);
        return newPosition;
    }

    update() {
        if (this.dimmingPlane) {
            const planeNormal = new THREE.Vector3(0, 0, 1);
            const viewVector = new THREE.Vector3();
            viewVector.copy(this.camera.instance.position);
            viewVector.sub(this.position);
            viewVector.normalize();
            const dot = viewVector.dot(planeNormal);
            const dimPos = this.dimmingPlane.position;
            const camPos = this.camera.instance.position;
            const distance = Math.sqrt(
                (camPos.x - dimPos.x) ** 2 +
                    (camPos.y - dimPos.y) ** 2 +
                    (camPos.z - dimPos.z) ** 2
            );
            const opacity = 1 / (distance / 10000);
            const DIM_FACTOR = 0.7;
            // @ts-ignore
            this.dimmingPlane.material.opacity = (1 - opacity) * DIM_FACTOR + (1 - dot) * DIM_FACTOR;
        }
    }
}