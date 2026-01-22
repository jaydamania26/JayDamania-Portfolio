import * as THREE from 'three';
import Sizes from '../Utils/Sizes';

export const MOBILE_BREAKPOINT = 768;

// Configurations for where the camera goes on Mobile
export const MobileSettings = {
    MONITOR: {
        // --- CONTROLS ---
        // Z: Higher number = Further away (Zoom Out), Lower = Closer (Zoom In)
        BASE_Z: 2200, 
        
        // X: Negative = Move Camera Left, Positive = Move Camera Right
        OFFSET_X: 0, 

        // Y: Higher = Move Camera Up, Lower = Move Camera Down
        HEIGHT_Y: 950, 
    }
};

export function isMobile(sizes: Sizes): boolean {
    return sizes.width < MOBILE_BREAKPOINT;
}

/**
 * Calculates the perfect position based on screen width
 */
export function getMobileMonitorPosition(sizes: Sizes): THREE.Vector3 {
    const aspect = sizes.width / sizes.height;
    
    // Automatic Zoom Calculation based on how narrow the screen is
    // We add the BASE_Z to this calculation.
    const distanceZ = MobileSettings.MONITOR.BASE_Z + (1 / aspect) * 200;
    
    return new THREE.Vector3(
        MobileSettings.MONITOR.OFFSET_X, 
        MobileSettings.MONITOR.HEIGHT_Y, 
        distanceZ
    );
}