import * as THREE from 'three';
import Sizes from '../Utils/Sizes';

// ==========================================
// 1. DEFINITIONS & SETTINGS
// ==========================================

// Screen width below this is considered Mobile
export const MOBILE_BREAKPOINT = 768;

// Camera Positions for Mobile View
export const MobileCameraViews = {
    DESK: {
        // High and far back to fit the desk vertically
        POSITION: new THREE.Vector3(0, 1800, 5500), 
        // Look slightly down at the keyboard
        FOCAL_POINT: new THREE.Vector3(0, 600, 0),
    },
    MONITOR: {
        // Base distance to start calculating Zoom
        BASE_Z: 3200, 
        // Height to keep the monitor centered
        HEIGHT_Y: 950,
    }
};

// List of 3D Object names that trigger "Zoom In" when touched
export const TOUCH_TARGETS = [
    'computer',
    'monitor',
    'screen',
    'display',
    'pc',
    'glass',
    'bezel',
    'stand',
    'hitbox',              // The invisible plane from MonitorScreen.ts
    'computer-screen-hitbox'
];

// ==========================================
// 2. LOGIC FUNCTIONS
// ==========================================

/**
 * Returns true if the device is mobile
 */
export function isMobile(sizes: Sizes): boolean {
    return sizes.width < MOBILE_BREAKPOINT;
}

/**
 * Calculates the exact Z position needed to fit the monitor 
 * inside a vertical mobile screen.
 */
export function getMobileMonitorPosition(sizes: Sizes): THREE.Vector3 {
    const aspect = sizes.width / sizes.height;
    
    // Math: The narrower the screen, the further back we go.
    const distanceZ = MobileCameraViews.MONITOR.BASE_Z + (1 / aspect) * 200;
    
    return new THREE.Vector3(0, MobileCameraViews.MONITOR.HEIGHT_Y, distanceZ);
}

/**
 * Checks if a clicked object name matches our list of Touch Targets.
 * Used in Camera.ts to detect if we hit the computer.
 */
export function isClickableComputerPart(objectName: string): boolean {
    const lowerName = objectName.toLowerCase();
    return TOUCH_TARGETS.some(target => lowerName.includes(target));
}