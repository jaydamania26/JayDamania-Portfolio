// src/Camera/MobileConfig.ts
import * as THREE from 'three';
import Sizes from '../Utils/Sizes';

export const MOBILE_BREAKPOINT = 768;

// Configurations for where the camera goes on Mobile
export const MobileSettings = {
    // The Desk View (Zoomed Out)
    DESK: {
        // Move camera far back (Z=5200) and higher (Y=1800) so the vertical phone screen sees the whole desk
        POSITION: new THREE.Vector3(0, 1800, 5200),
        // Look slightly lower to see keyboard and items
        FOCAL_POINT: new THREE.Vector3(0, 600, 0),
    },
    
    // The Monitor View (Zoomed In)
    MONITOR: {
        BASE_Z: 3200,  // Start this far back
        HEIGHT_Y: 950, // Keep centered vertically
    }
};

/**
 * Returns true if the screen width is less than 768px
 */
export function isMobile(sizes: Sizes): boolean {
    return sizes.width < MOBILE_BREAKPOINT;
}

/**
 * Calculates the perfect Z position for the camera on mobile.
 * The narrower the phone screen, the further back the camera moves
 * so the computer monitor doesn't get cut off.
 */
export function getMobileMonitorPosition(sizes: Sizes): THREE.Vector3 {
    const aspect = sizes.width / sizes.height;
    
    // Math: The smaller the aspect ratio, the larger the distance needs to be.
    // 3200 is base, 200 is the multiplier.
    const distanceZ = MobileSettings.MONITOR.BASE_Z + (1 / aspect) * 200;
    
    return new THREE.Vector3(0, MobileSettings.MONITOR.HEIGHT_Y, distanceZ);
}