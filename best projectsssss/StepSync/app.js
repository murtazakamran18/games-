class PrecisionStepTracker {
    constructor() {
        // DOM Elements
        this.stepCountDisplay = document.getElementById('stepCount');
        this.distanceDisplay = document.getElementById('distanceCount');
        this.caloriesDisplay = document.getElementById('caloriesBurned');
        this.progressFill = document.getElementById('progressFill');
        this.progressText = document.getElementById('progressText');
        this.activityLog = document.getElementById('activityLog');
        this.permissionStatus = document.getElementById('permissionStatus');

        // Settings Elements
        this.dailyGoalInput = document.getElementById('dailyGoal');
        this.setGoalBtn = document.getElementById('setGoalBtn');
        this.userWeightInput = document.getElementById('userWeight');
        this.setWeightBtn = document.getElementById('setWeightBtn');

        // Core Tracking Variables
        this.steps = 0;
        this.dailyGoal = 10000;
        this.userWeight = 70; // kg
        this.stepLength = 0.7; // average step length in meters

        // Advanced Step Detection State
        this.stepDetectionState = {
            accelerationHistory: [],
            lastStepTime: 0,
            stepCooldown: 300, // ms between steps
            peakThreshold: 12,
            valleyThreshold: -12,
            stepConfidence: 0,
            stepSignature: {
                peaks: [],
                valleys: [],
                magnitudes: []
            }
        };

        // Initialize tracking
        this.setupEventListeners();
        this.loadSettings();
        this.initializeMotionTracking();
    }

    initializeMotionTracking() {
        if ('DeviceMotionEvent' in window) {
            // Request permission for iOS devices
            if (typeof DeviceMotionEvent.requestPermission === 'function') {
                DeviceMotionEvent.requestPermission()
                    .then(response => {
                        if (response === 'granted') {
                            window.addEventListener('devicemotion', this.processMotionData.bind(this));
                            this.updatePermissionStatus('Motion Tracking: Enabled');
                        } else {
                            this.updatePermissionStatus('Motion Tracking: Permission Denied');
                        }
                    })
                    .catch(console.error);
            } else {
                // For non-iOS devices
                window.addEventListener('devicemotion', this.processMotionData.bind(this));
                this.updatePermissionStatus('Motion Tracking: Active');
            }
        } else {
            this.fallbackManualTracking();
        }
    }

    processMotionData(event) {
        const acceleration = event.acceleration || event.accelerationIncludingGravity;
        if (!acceleration) return;

        const { x, y, z } = acceleration;
        const currentTime = Date.now();

        // Detect step using advanced algorithm
        const stepDetected = this.detectStep(x, y, z, currentTime);
        
        if (stepDetected) {
            this.recordStep();
        }
    }

    detectStep(x, y, z, currentTime) {
        const state = this.stepDetectionState;
        
        // Calculate acceleration magnitude
        const magnitude = Math.sqrt(x*x + y*y + z*z);
        
        // Manage acceleration history
        state.accelerationHistory.push({ x, y, z, magnitude, time: currentTime });
        if (state.accelerationHistory.length > 10) {
            state.accelerationHistory.shift();
        }

        // Movement detection criteria
        const movementThreshold = 9.8; // Standard gravity threshold
        const isSignificantMovement = magnitude > movementThreshold;
        
        // Vertical movement detection (walking signature)
        const verticalMovement = Math.abs(y);
        const isVerticalStep = verticalMovement > 6;

        // Time since last step
        const timeSinceLastStep = currentTime - state.lastStepTime;
        const isValidStepInterval = timeSinceLastStep > state.stepCooldown;

        // Peak and valley detection for walking pattern
        if (y > state.peakThreshold) {
            state.stepSignature.peaks.push({ time: currentTime, value: y });
        }
        if (y < state.valleyThreshold) {
            state.stepSignature.valleys.push({ time: currentTime, value: y });
        }

        // Limit signature history
        if (state.stepSignature.peaks.length > 5) state.stepSignature.peaks.shift();
        if (state.stepSignature.valleys.length > 5) state.stepSignature.valleys.shift();

        // Confidence calculation using multiple factors
        let confidence = 0;
        confidence += isSignificantMovement ? 0.4 : 0;
        confidence += isValidStepInterval ? 0.3 : 0;
        confidence += isVerticalStep ? 0.3 : 0;

        // Additional walking pattern validation
        if (state.stepSignature.peaks.length > 1 && state.stepSignature.valleys.length > 1) {
            const lastPeak = state.stepSignature.peaks[state.stepSignature.peaks.length - 1];
            const lastValley = state.stepSignature.valleys[state.stepSignature.valleys.length - 1];
            
            // Check peak-valley timing consistency
            const peakValleyTimeDiff = Math.abs(lastPeak.time - lastValley.time);
            if (peakValleyTimeDiff > 100 && peakValleyTimeDiff < 500) {
                confidence += 0.2;
            }
        }

        // Final step detection
        const isStep = confidence > 0.8 && isValidStepInterval;

        // Reset or update state
        if (isStep) {
            state.stepConfidence = confidence;
            state.stepSignature.magnitudes.push(magnitude);
        }

        return isStep;
    }

    recordStep() {
        const currentTime = Date.now();
        const state = this.stepDetectionState;

        // Update step count and tracking
        this.steps++;
        state.lastStepTime = currentTime;

        // Update display and log
        this.updateDisplay();
        this.logActivity('Step detected');
        this.saveSettings();
    }

    updateDisplay() {
        // Update step count
        this.stepCountDisplay.textContent = this.steps;

        // Calculate distance (km)
        const distanceInKm = (this.steps * this.stepLength) / 1000;
        this.distanceDisplay.textContent = distanceInKm.toFixed(2) + ' km';

        // Calculate calories burned
        const caloriesBurned = Math.round((this.steps / 1000) * this.userWeight * 0.5);
        this.caloriesDisplay.textContent = caloriesBurned;

        // Update progress
        const progressPercentage = Math.min((this.steps / this.dailyGoal) * 100, 100);
        this.progressFill.style.width = `${progressPercentage}%`;
        this.progressText.textContent = `${Math.round(progressPercentage)}%`;
    }

    logActivity(message) {
        const li = document.createElement('li');
        li.textContent = `${new Date().toLocaleTimeString()}: ${message}`;
        this.activityLog.prepend(li);
        
        // Limit activity log to 10 entries
        if (this.activityLog.children.length > 10) {
            this.activityLog.lastElementChild.remove();
        }
    }

    setupEventListeners() {
        // Manual Step Addition
        const manualStepBtn = document.createElement('button');
        manualStepBtn.textContent = 'Add Step Manually';
        manualStepBtn.addEventListener('click', () => {
            this.steps++;
            this.updateDisplay();
            this.logActivity('Manual step added');
        });
        this.permissionStatus.appendChild(manualStepBtn);

        // Daily Goal Setting
        this.setGoalBtn.addEventListener('click', () => {
            const newGoal = parseInt(this.dailyGoalInput.value);
            if (newGoal > 0) {
                this.dailyGoal = newGoal;
                this.updateDisplay();
                this.saveSettings();
            }
        });

        // User Weight Setting
        this.setWeightBtn.addEventListener('click', () => {
            const newWeight = parseFloat(this.userWeightInput.value);
            if (newWeight > 0) {
                this.userWeight = newWeight;
                this.updateDisplay();
                this.saveSettings();
            }
        });
    }

    updatePermissionStatus(message) {
        this.permissionStatus.textContent = message;
    }

    fallbackManualTracking() {
        this.updatePermissionStatus('Automatic Tracking Unavailable');
        alert('Your device does not support automatic step tracking. Please use manual mode.');
    }

    saveSettings() {
        localStorage.setItem('stepTrackerSettings', JSON.stringify({
            steps: this.steps,
            dailyGoal: this.dailyGoal,
            userWeight: this.userWeight
        }));
    }

    loadSettings() {
        const savedSettings = localStorage.getItem('stepTrackerSettings');
        if (savedSettings) {
            const settings = JSON.parse(savedSettings);
            this.steps = settings.steps || 0;
            this.dailyGoal = settings.dailyGoal || 10000;
            this.userWeight = settings.userWeight || 70;

            // Update input fields
            this.dailyGoalInput.value = this.dailyGoal;
            this.userWeightInput.value = this.userWeight;
            this.updateDisplay();
        }
    }
}

// Initialize the app when the DOM is fully loaded
document.addEventListener('DOMContentLoaded', () => {
    new PrecisionStepTracker();
});
