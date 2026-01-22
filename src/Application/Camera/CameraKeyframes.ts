import * as THREE from 'three';
import { CameraKey } from './Camera';
import Time from '../Utils/Time';
import Application from '../Application';
import Mouse from '../Utils/Mouse';
import Sizes from '../Utils/Sizes';

export interface CameraKeyframe {
    position: THREE.Vector3;
    focalPoint: THREE.Vector3;
}

export class CameraKeyframeInstance {
    position: THREE.Vector3;
    focalPoint: THREE.Vector3;

    constructor(keyframe: CameraKeyframe) {
        this.position = keyframe.position;
        this.focalPoint = keyframe.focalPoint;
    }

    update() {}
}

// 1. UPDATED BASE COORDINATES
const keys: { [key in CameraKey]: CameraKeyframe } = {
    idle: {
        position: new THREE.Vector3(-20000, 12000, 20000),
        focalPoint: new THREE.Vector3(0, -1000, 0),
    },
    monitor: {
        // Base position for PC Zoom
        position: new THREE.Vector3(0, 950, 1300),
        focalPoint: new THREE.Vector3(0, 950, 0),
    },
    desk: {
        // Updated to match your screenshot (Closer and lower)
        position: new THREE.Vector3(0, 1600, 3200),
        focalPoint: new THREE.Vector3(0, 750, 0),
    },
    loading: {
        position: new THREE.Vector3(-35000, 35000, 35000),
        focalPoint: new THREE.Vector3(0, -5000, 0),
    },
    orbitControlsStart: {
        position: new THREE.Vector3(-15000, 10000, 15000),
        focalPoint: new THREE.Vector3(-100, 350, 0),
    },
};

export class MonitorKeyframe extends CameraKeyframeInstance {
    application: Application;
    sizes: Sizes;
    targetPos: THREE.Vector3;
    origin: THREE.Vector3;

    constructor() {
        const keyframe = keys.monitor;
        super(keyframe);
        this.application = new Application();
        this.sizes = this.application.sizes;
        this.origin = new THREE.Vector3().copy(keyframe.position);
        this.targetPos = new THREE.Vector3().copy(keyframe.position);
    }

    update() {
        // 2. MOBILE MONITOR LOGIC
        // If screen is narrow (Mobile), we must move camera BACK (increase Z)
        // to fit the horizontal monitor on a vertical screen.
        const isMobile = this.sizes.width < 768;
        const aspect = this.sizes.width / this.sizes.height;

        if (isMobile) {
            // On mobile, calculate distance based on how narrow the screen is
            // The narrower the screen, the further back we go.
            const distanceOffset = 3200 + (1 / aspect) * 200; 
            this.targetPos.z = distanceOffset;
            this.targetPos.y = 950; // Keep centered on screen Y
        } else {
            // PC: Close up view
            this.targetPos.z = 1300;
            this.targetPos.y = 950;
        }

        this.position.copy(this.targetPos);
    }
}

export class LoadingKeyframe extends CameraKeyframeInstance {
    constructor() {
        const keyframe = keys.loading;
        super(keyframe);
    }

    update() {}
}

export class DeskKeyframe extends CameraKeyframeInstance {
    origin: THREE.Vector3;
    application: Application;
    mouse: Mouse;
    sizes: Sizes;
    targetFoc: THREE.Vector3;
    targetPos: THREE.Vector3;

    constructor() {
        const keyframe = keys.desk;
        super(keyframe);
        this.application = new Application();
        this.mouse = this.application.mouse;
        this.sizes = this.application.sizes;
        this.origin = new THREE.Vector3().copy(keyframe.position);
        this.targetFoc = new THREE.Vector3().copy(keyframe.focalPoint);
        this.targetPos = new THREE.Vector3().copy(keyframe.position);
    }

    update() {
        const isMobile = this.sizes.width < 768;

        // 3. DESK VIEW LOGIC
        if (isMobile) {
            // MOBILE: Static position, further back so desk fits vertically
            this.targetPos.x = 0;
            this.targetPos.y = 1800;
            this.targetPos.z = 5200; // Further back for mobile
            
            // Look slightly lower
            this.targetFoc.x = 0;
            this.targetFoc.y = 600;
        } else {
            // PC: Interactive Mouse Parallax
            // Moves the camera slightly based on mouse position
            this.targetFoc.x += (this.mouse.x - this.sizes.width / 2 - this.targetFoc.x) * 0.05;
            this.targetFoc.y += (-(this.mouse.y - this.sizes.height) - this.targetFoc.y) * 0.05;

            this.targetPos.x += (this.mouse.x - this.sizes.width / 2 - this.targetPos.x) * 0.01;
            this.targetPos.y += (-(this.mouse.y - this.sizes.height * 2) - this.targetPos.y) * 0.01;

            // PC Base Z Position
            this.targetPos.z = this.origin.z;
            
            // Limit Y movement to prevent going under floor
            if(this.targetPos.y < 1200) this.targetPos.y = 1200;
        }

        this.focalPoint.copy(this.targetFoc);
        this.position.copy(this.targetPos);
    }
}

export class IdleKeyframe extends CameraKeyframeInstance {
    time: Time;
    origin: THREE.Vector3;

    constructor() {
        const keyframe = keys.idle;
        super(keyframe);
        this.origin = new THREE.Vector3().copy(keyframe.position);
        this.time = new Time();
    }

    update() {
        // Subtle Orbiting animation
        this.position.x = Math.sin((this.time.elapsed + 19000) * 0.00008) * this.origin.x;
        this.position.y = Math.sin((this.time.elapsed + 1000) * 0.000004) * 4000 + this.origin.y - 3000;
        // Keep Z consistent
        this.position.z = this.origin.z;
    }
}

export class OrbitControlsStart extends CameraKeyframeInstance {
    constructor() {
        const keyframe = keys.orbitControlsStart;
        super(keyframe);
    }

    update() {}
}