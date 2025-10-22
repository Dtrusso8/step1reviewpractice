// Dynamic Drag and Drop Activity App
class DynamicDragDropActivity {
    constructor() {
        this.currentActivity = null;
        this.activities = [];
        this.dropZones = [];
        this.currentMode = 'selection'; // Start with activity selection
        this.selectedZone = null;
        this.draggedElement = null;
        // Offline FS state
        this.isOffline = false;
        this.offlineRootHandle = null;
        
        // New properties for student tracking
        this.studentName = '';
        this.activityStartTime = null;
        this.activityEndTime = null;
        this.timerInterval = null;
        this.isActivityActive = false;
        
        // Password protection properties
        this.teacherPassword = '0000';
        this.isTeacherModeUnlocked = false;

        // Initialize AnswerHandler
        this.answerHandler = new AnswerHandler(this);
        
        // Initialize TextFitting
        this.textFitting = new TextFitting(this.dropZones);
        
        this.initializeElements();
        this.loadActivities();
        this.setupEventListeners();
    }

    // ----- Offline File System Access helpers -----
    async pickOfflineRoot() {
        if (!window.showDirectoryPicker) throw new Error('Browser not supported');
        this.offlineRootHandle = await window.showDirectoryPicker({ mode: 'read' });
        this.isOffline = true;
    }

    async readTextFileViaFS(path) {
        if (!this.offlineRootHandle) throw new Error('No offline folder selected');
        const handle = await this.getFileHandleByPath(path);
        const file = await handle.getFile();
        return await file.text();
    }

    async getFileHandleByPath(path) {
        const segments = path.split('/').filter(Boolean);
        let dir = this.offlineRootHandle;
        for (let i = 0; i < segments.length; i++) {
            const name = segments[i];
            const last = i === segments.length - 1;
            if (last) {
                return await dir.getFileHandle(name);
            } else {
                dir = await dir.getDirectoryHandle(name);
            }
        }
        throw new Error(`Invalid path: ${path}`);
    }

    initializeElements() {
        // Activity selection elements
        this.activitySelector = document.getElementById('activity-selector');
        this.loadActivityBtn = document.getElementById('load-activity-btn');
        this.selectOfflineFolderBtn = document.getElementById('select-offline-folder-btn');
        this.studentNameInput = document.getElementById('student-name');
        
        // Teacher mode elements
        this.teacherMode = document.getElementById('teacher-mode');
        this.activityTitle = document.getElementById('activity-title');
        this.addZoneBtn = document.getElementById('add-zone-btn');
        this.clearTermsBtn = document.getElementById('clear-terms-btn');
        this.saveToFileBtn = document.getElementById('save-to-file-btn');
        this.switchToStudentBtn = document.getElementById('switch-to-student-btn');
        this.backToSelectionBtn = document.getElementById('back-to-selection-btn');
        
        // Debug: Check if elements are found
        console.log('Switch to Student button found:', this.switchToStudentBtn);
        console.log('Add Zone button found:', this.addZoneBtn);
        console.log('Clear Terms button found:', this.clearTermsBtn);
        this.activityImage = document.getElementById('activity-image');
        this.dropZonesContainer = document.getElementById('drop-zones-container');
        this.termsList = document.getElementById('terms-list');
        
        // Zone configuration elements
        this.zoneConfig = document.getElementById('zone-config');
        this.zoneAcceptedTerms = document.getElementById('zone-accepted-terms');
        this.zoneMinRequired = document.getElementById('zone-min-required');
        this.zoneMaxAllowed = document.getElementById('zone-max-allowed');
        this.zoneUnlimited = document.getElementById('zone-unlimited');
        this.zoneConfigFields = document.getElementById('zone-config-fields');
        this.zoneX = document.getElementById('zone-x');
        this.zoneY = document.getElementById('zone-y');
        this.zoneWidth = document.getElementById('zone-width');
        this.zoneHeight = document.getElementById('zone-height');
        this.saveZoneBtn = document.getElementById('save-zone-btn');
        this.cancelZoneBtn = document.getElementById('cancel-zone-btn');
        this.deleteZoneBtn = document.getElementById('delete-zone-btn');
        this.resizeAllZonesBtn = document.getElementById('resize-all-zones-btn');
        
        // Student mode elements
        this.studentMode = document.getElementById('student-mode');
        this.activityTitleDisplay = document.getElementById('activity-title-display');
        this.startActivityBtn = document.getElementById('start-activity-btn');
        this.backToTeacherBtn = document.getElementById('back-to-teacher-btn');
        this.activityImageDisplay = document.getElementById('activity-image'); // Use shared image
        this.activityDropZones = document.getElementById('drop-zones-container'); // Use shared drop zones
        this.labelsContainer = document.getElementById('labels-container');
        this.progressFill = document.getElementById('progress-fill');
        this.progressText = document.getElementById('progress-text');
        this.feedback = document.getElementById('feedback');
        this.resetBtn = document.getElementById('reset-btn');
        
        // New student tracking elements
        this.studentInfo = document.getElementById('student-info');
        this.displayStudentName = document.getElementById('display-student-name');
        this.timerDisplay = document.getElementById('timer-display');
        this.submitScoreBtn = document.getElementById('submit-score-btn');
        
        // Password modal elements
        this.passwordModal = document.getElementById('password-modal');
        this.teacherPasswordInput = document.getElementById('teacher-password');
        this.submitPasswordBtn = document.getElementById('submit-password-btn');
        this.cancelPasswordBtn = document.getElementById('cancel-password-btn');
        
        // Back to selection button for students
        this.backToSelectionStudentBtn = document.getElementById('back-to-selection-student-btn');

        // Instructions modal elements
        this.instructionsModal = document.getElementById('instructions-modal');
        this.instructionsOpenBtn = document.getElementById('open-instructions-btn');
        this.instructionsCloseBtn = document.getElementById('instructions-close');
        this.instructionsBody = document.getElementById('instructions-body');
    }

    async loadActivities() {
        try {
            // Load activities using the ActivityLoader
            const loader = new ActivityLoader();
            // If not offline, use default flow
            if (!this.isOffline) {
                this.activities = await loader.scanActivitiesFolder();
            } else {
                // Offline: read activities.json from selected folder
                const text = await this.readTextFileViaFS('activities.json');
                const data = JSON.parse(text);
                this.activities = Array.isArray(data.activities) ? data.activities : [];
            }
            
            this.populateActivitySelector();
            
            // Don't auto-load - let user select activity
        } catch (error) {
            console.error('Error loading activities:', error);
            this.showFeedback('Error loading activities. Please check the Activities folder.', 'error');
        }
    }

    populateActivitySelector() {
        this.activitySelector.innerHTML = '<option value="">Choose an activity...</option>';
        this.activities.forEach(activity => {
            const option = document.createElement('option');
            option.value = activity.name;
            option.textContent = activity.displayName;
            this.activitySelector.appendChild(option);
        });
    }

    setupEventListeners() {
        // Activity selection
        this.loadActivityBtn.addEventListener('click', () => this.loadSelectedActivity());
        // Offline button
        if (this.selectOfflineFolderBtn) {
            this.selectOfflineFolderBtn.addEventListener('click', async () => {
                try {
                    await this.pickOfflineRoot();
                    await this.loadActivities();
                    this.showFeedback('Offline folder selected. Activities loaded from disk.', 'success');
                } catch (e) {
                    console.error('Offline selection failed:', e);
                    this.showFeedback('Select the folder containing index.html and activities.json', 'error');
                }
            });
        }
        
        // Teacher mode
        this.addZoneBtn.addEventListener('click', () => this.addDropZone());
        this.clearTermsBtn.addEventListener('click', () => this.clearAllTerms());
        this.saveToFileBtn.addEventListener('click', () => this.saveToFile());
        this.switchToStudentBtn.addEventListener('click', () => {
            console.log('Switch to Student button clicked!');
            this.switchToStudentMode();
        });
        this.backToSelectionBtn.addEventListener('click', () => this.showSelectionMode());
        
        // Zone configuration
        this.saveZoneBtn.addEventListener('click', () => this.saveZone());
        this.cancelZoneBtn.addEventListener('click', () => this.cancelZoneEdit());
        this.deleteZoneBtn.addEventListener('click', () => this.deleteZone());
        
        // Resize all zones button
        this.resizeAllZonesBtn.addEventListener('click', () => this.resizeAllZones());
        
        // New zone configuration UI elements
        this.zoneUnlimited.addEventListener('change', () => this.handleUnlimitedChange());
        
        // Student mode
        this.startActivityBtn.addEventListener('click', () => this.startActivity());
        this.backToTeacherBtn.addEventListener('click', () => this.showTeacherMode());
        this.resetBtn.addEventListener('click', () => this.resetActivity());
        this.submitScoreBtn.addEventListener('click', () => this.answerHandler.submitScore());
        this.backToSelectionStudentBtn.addEventListener('click', () => this.backToSelectionFromStudent());
        
        // Password modal
        this.submitPasswordBtn.addEventListener('click', () => this.checkTeacherPassword());
        this.cancelPasswordBtn.addEventListener('click', () => this.hidePasswordModal());
        this.teacherPasswordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.checkTeacherPassword();
            }
        });
        
        // Handle window resize to maintain zone positioning
        window.addEventListener('resize', () => {
            if (this.currentActivity && this.dropZones.length > 0) {
                // Re-validate positions and re-render zones
                setTimeout(() => {
                    this.validateZonePositions();
                    this.synchronizeZonePositions();
                    
                    if (this.currentMode === 'teacher') {
                        this.renderDropZones();
                        // Refit text after re-rendering teacher zones
                        this.textFitting.fitAllPlacedLabels(this.activityDropZones);
                    } else if (this.currentMode === 'student') {
                        this.createActivityDropZones();
                        // Refit text after re-rendering student zones
                        this.textFitting.fitAllPlacedLabels(this.activityDropZones);
                    }
                }, 150); // Slightly longer delay to ensure resize is complete
            }
        });

        // Instructions modal open/close
        if (this.instructionsOpenBtn) {
            this.instructionsOpenBtn.addEventListener('click', () => this.openInstructions());
        }
        if (this.instructionsCloseBtn) {
            this.instructionsCloseBtn.addEventListener('click', () => this.closeInstructions());
        }
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.instructionsModal && this.instructionsModal.style.display !== 'none') {
                this.closeInstructions();
            }
        });
    }

    async openInstructions() {
        if (!this.instructionsModal) return;
        // Show modal
        this.instructionsModal.style.display = 'flex';
        // Load content
        await this.loadInstructionsContent();
    }

    closeInstructions() {
        if (!this.instructionsModal) return;
        this.instructionsModal.style.display = 'none';
        // Cleanup body content except title and loader container
        const body = this.instructionsBody;
        if (body) {
            body.innerHTML = '<h2 id="instructions-title" style="margin-bottom: 12px;">Instructions</h2><div id="instructions-loader" style="text-align:center; padding: 20px;">Loading…</div>';
        }
    }

    async loadInstructionsContent() {
        const container = this.instructionsBody;
        if (!container) return;
        const loader = container.querySelector('#instructions-loader');
        if (loader) loader.textContent = 'Loading…';

        // Determine candidate files within "Instructions button" folder
        const folder = 'Instructions button';
        const candidates = [
            'instructions.html',
            'index.html',
            'instructions.md',
            'instructions.pdf',
            'instructions.png', 'instructions.jpg', 'instructions.jpeg', 'instructions.webp', 'instructions.gif',
            'README.md'
        ];

        try {
            let loaded = false;

            // Offline mode: use File System Access API
            if (this.isOffline && this.offlineRootHandle) {
                for (const name of candidates) {
                    try {
                        const path = `${folder}/${name}`;
                        const textExtensions = ['.html', '.md'];
                        if (textExtensions.some(ext => name.toLowerCase().endsWith(ext))) {
                            const content = await this.readTextFileViaFS(path);
                            this.renderInstructions(container, name, content);
                            loaded = true;
                            break;
                        } else {
                            // For binary types (image/pdf), build an object URL
                            const fileHandle = await this.getFileHandleByPath(path);
                            const file = await fileHandle.getFile();
                            const url = URL.createObjectURL(file);
                            this.renderInstructions(container, name, url, true);
                            loaded = true;
                            break;
                        }
                    } catch (_) { /* try next */ }
                }
            } else {
                // Online mode: try fetch from relative path; append cache-buster
                for (const name of candidates) {
                    const url = `${folder}/${name}`;
                    const buster = `?v=${Date.now()}`;
                    if (name.endsWith('.html') || name.endsWith('.md')) {
                        const res = await fetch(url + buster, { cache: 'no-store' });
                        if (res.ok) {
                            const content = await res.text();
                            this.renderInstructions(container, name, content);
                            loaded = true;
                            break;
                        }
                    } else {
                        // For binary types, just point the src/href; we can't verify easily without HEAD
                        this.renderInstructions(container, name, url + buster, true);
                        loaded = true;
                        break;
                    }
                }
            }

            if (!loaded) {
                if (loader) loader.remove();
                const msg = document.createElement('div');
                msg.style.textAlign = 'center';
                msg.style.padding = '20px';
                msg.textContent = 'No instructions content found in "Instructions button" folder.';
                container.appendChild(msg);
            }
        } catch (e) {
            console.error('Failed to load instructions:', e);
            if (loader) loader.remove();
            const msg = document.createElement('div');
            msg.style.textAlign = 'center';
            msg.style.padding = '20px';
            msg.textContent = 'Error loading instructions.';
            container.appendChild(msg);
        }
    }

    renderInstructions(container, filename, payload, isBinary = false) {
        // Clear loader/content under the title
        container.innerHTML = '<h2 id="instructions-title" style="margin-bottom: 12px;">Instructions</h2>';

        const lower = filename.toLowerCase();
        if (lower.endsWith('.html')) {
            const wrapper = document.createElement('div');
            wrapper.className = 'instructions-content';
            wrapper.innerHTML = payload;
            container.appendChild(wrapper);
        } else if (lower.endsWith('.md')) {
            // Minimal markdown to HTML: paragraphs and line breaks
            const html = payload
                .split('\n\n')
                .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`) // very basic
                .join('');
            const wrapper = document.createElement('div');
            wrapper.className = 'instructions-content';
            wrapper.innerHTML = html;
            container.appendChild(wrapper);
        } else if (lower.endsWith('.pdf')) {
            const iframe = document.createElement('iframe');
            iframe.className = 'instructions-content';
            iframe.src = isBinary ? payload : `${payload}`;
            container.appendChild(iframe);
        } else if (lower.match(/\.(png|jpe?g|webp|gif)$/)) {
            const img = document.createElement('img');
            img.className = 'instructions-content';
            img.src = isBinary ? payload : `${payload}`;
            container.appendChild(img);
        } else {
            const pre = document.createElement('pre');
            pre.textContent = 'Unsupported instructions format.';
            container.appendChild(pre);
        }
    }

    async loadSelectedActivity() {
        console.log('Load Activity button clicked');
        const selectedActivityName = this.activitySelector.value;
        console.log('Selected activity name:', selectedActivityName);
        
        if (!selectedActivityName) {
            this.showFeedback('Please select an activity first.', 'error');
            return;
        }

        // Use existing student name or validate new input
        let studentName = this.studentNameInput.value.trim();
        console.log('Student name:', studentName);
        
        if (!studentName) {
            this.showFeedback('Please enter your name before loading an activity.', 'error');
            return;
        }

        // Update student name if it changed
        if (studentName !== this.studentName) {
            this.studentName = studentName;
        }

        this.currentActivity = this.activities.find(a => a.name === selectedActivityName);
        console.log('Found activity:', this.currentActivity);
        
        if (!this.currentActivity) {
            this.showFeedback('Activity not found.', 'error');
            return;
        }

        // Per-activity password gate from generated JSON
        try {
            const enabled = (typeof window !== 'undefined') && (window.PASSWORDS_ENABLED === true);
            const required = enabled ? (this.currentActivity.password || '') : '';
            if (required) {
                const input = (window.prompt(`Enter password for "${this.currentActivity.displayName}":`) || '').trim();
                if (input !== required) {
                    this.showFeedback('Incorrect activity password.', 'error');
                    return;
                }
            }
        } catch (e) {
            console.warn('Password check failed; proceeding without gate.', e);
        }

        // NEW: Reset UI state for clean slate (defensive clear)
        this.resetUIState();

        // Load terms and setup data for the selected activity
        try {
            if (this.isOffline) {
                // Offline: read via FS API
                const termsText = await this.readTextFileViaFS(this.currentActivity.termsFile);
                this.currentActivity.terms = termsText.split('\n').map(t => t.trim()).filter(t => t.length > 0);
                try {
                    const setupText = await this.readTextFileViaFS(this.currentActivity.setupFile);
                    this.currentActivity.setup = JSON.parse(setupText);
                } catch (_) {
                    this.currentActivity.setup = { dropZones: [] };
                }
            } else {
                const loader = new ActivityLoader();
                this.currentActivity.terms = await loader.loadTermsForActivity(this.currentActivity);
                this.currentActivity.setup = await loader.loadSetupForActivity(this.currentActivity);
            }
            console.log('Loaded activity data:', this.currentActivity);
        } catch (error) {
            console.error('Error loading activity data:', error);
            this.showFeedback('Error loading activity data.', 'error');
            return;
        }

        console.log('Loading activity image:', this.currentActivity.image);
        
        // Load activity image and show student mode
        this.activityImage.src = this.currentActivity.image;
        this.activityImage.onload = () => {
            console.log('Activity image loaded successfully');
            // Show the image section now that it's loaded
            document.getElementById('activity-image-section').style.display = 'block';
            // Load drop zones first, then show student mode
            this.loadDropZones();
            this.showStudentMode();
        };
        this.activityImage.onerror = () => {
            console.error('Error loading activity image');
            this.showFeedback('Error loading activity image.', 'error');
        };
    }

    showTeacherMode() {
        // Check if teacher mode is unlocked
        if (!this.isTeacherModeUnlocked) {
            this.showPasswordModal();
            return;
        }
        
        this.currentMode = 'teacher';
        document.getElementById('activity-selection').style.display = 'none';
        this.teacherMode.style.display = 'block';
        this.studentMode.style.display = 'none';
        
        // Hide student containers
        document.getElementById('student-activity-title').style.display = 'none';
        document.getElementById('student-controls-container').style.display = 'none';
        document.getElementById('student-info-container').style.display = 'none';
        
        // Show the image section for teacher mode
        document.getElementById('activity-image-section').style.display = 'block';
        
        this.activityTitle.textContent = this.currentActivity.displayName;
        this.loadTerms();
        
        // Ensure image is loaded before positioning zones
        if (this.activityImage.complete) {
            setTimeout(() => {
                this.loadDropZones();
            }, 100);
        } else {
            this.activityImage.onload = () => {
                setTimeout(() => {
                    this.loadDropZones();
                }, 100);
            };
        }
    }

    showPasswordModal() {
        this.passwordModal.style.display = 'flex';
        this.teacherPasswordInput.value = '';
        this.teacherPasswordInput.focus();
    }

    showStudentMode() {
        console.log('Showing student mode...');
        this.currentMode = 'student';
        
        // NEW: Reset UI state for clean slate
        this.resetUIState();
        
        // Hide other modes
        document.getElementById('activity-selection').style.display = 'none';
        this.teacherMode.style.display = 'none';
        
        // Show student containers and student mode
        document.getElementById('student-activity-title').style.display = 'block';
        document.getElementById('student-controls-container').style.display = 'block';
        document.getElementById('student-info-container').style.display = 'block';
        this.studentMode.style.display = 'block';
        
        // Set up student mode content
        this.activityTitleDisplay.textContent = this.currentActivity.displayName;
        this.activityImageDisplay.src = this.currentActivity.image;
        
        // Display student name
        this.displayStudentName.textContent = this.studentName;
        
        // Ensure image is loaded before positioning zones
        this.activityImageDisplay.onload = () => {
            // Wait a bit more to ensure the image is fully rendered
            setTimeout(() => {
                // Load drop zones first
                this.loadDropZones(true); // keep zones, but don't render setup zones in student view
                
                console.log('Creating activity drop zones...');
                this.createActivityDropZones();
                
                console.log('Creating draggable labels...');
                this.createDraggableLabels();
                
                // Check if we have any assigned terms
                const assignedTerms = this.dropZones.flatMap(z => z.acceptedTerms).filter(t => t);
                if (assignedTerms.length === 0) {
                    // No terms assigned - show message to go to teacher mode
                    this.labelsContainer.innerHTML = `
                        <h3>No Activity Setup</h3>
                        <div class="student-instructions">
                            <p>This activity hasn't been set up yet. Please switch to Teacher Mode to configure the drop zones.</p>
                            <button id="go-to-teacher-btn" class="primary-button">Go to Teacher Mode</button>
                        </div>
                    `;
                    
                    // Add event listener for the button
                    document.getElementById('go-to-teacher-btn').addEventListener('click', () => {
                        this.showTeacherMode();
                    });
                }
                
                console.log('Student mode setup complete');
                // Ensure progress shows term-based totals immediately on load
                this.answerHandler.updateProgress();
            }, 100); // Small delay to ensure image is fully rendered
        };
    }

    showSelectionMode() {
        this.currentMode = 'selection';
        document.getElementById('activity-selection').style.display = 'block';
        this.teacherMode.style.display = 'none';
        this.studentMode.style.display = 'none';
        
        // Hide student containers and image section on selection page
        document.getElementById('student-activity-title').style.display = 'none';
        document.getElementById('student-controls-container').style.display = 'none';
        document.getElementById('student-info-container').style.display = 'none';
        document.getElementById('activity-image-section').style.display = 'none';
        
        // Clear current activity
        this.currentActivity = null;
        this.dropZones = [];
        this.selectedZone = null;
        
        // Reset activity tracking state but preserve student name
        this.activityStartTime = null;
        this.activityEndTime = null;
        this.isActivityActive = false;
        
        // Stop timer if running
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        
        // NEW: Reset UI state for clean slate
        this.resetUIState();
        
        // Note: We don't clear this.studentName or this.studentNameInput.value
        // so the name persists when switching activities
    }

    loadTerms() {
        this.termsList.innerHTML = '';
        this.currentActivity.terms.forEach(term => {
            const termItem = document.createElement('div');
            termItem.className = 'term-item';
            termItem.textContent = term;
            termItem.dataset.term = term;
            this.termsList.appendChild(termItem);
        });
        
        // Populate zone accepted terms multiselect
        this.populateTermsMultiselect();
    }

    populateTermsMultiselect() {
        this.zoneAcceptedTerms.innerHTML = '';
        this.currentActivity.terms.forEach((term, i) => {
            const termCheckbox = document.createElement('div');
            termCheckbox.className = 'term-checkbox';
            
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.id = `term-${i}`;  // simple, collision-proof id
            checkbox.value = term;
            
            const label = document.createElement('label');
            label.htmlFor = `term-${i}`;
            label.textContent = term;
            
            termCheckbox.appendChild(checkbox);
            termCheckbox.appendChild(label);
            this.zoneAcceptedTerms.appendChild(termCheckbox);
        });
    }

    loadDropZones(skipRender = false) {
        console.log('Loading drop zones for activity:', this.currentActivity.name);
        console.log('Activity setup data:', this.currentActivity.setup);

        // 1) If we already have zones in memory for this activity, keep them.
        if (Array.isArray(this.dropZones) && this.dropZones.length > 0) {
            this.convertLegacyZones();
            this.validateZonePositions();
            this.synchronizeZonePositions();
            if (!skipRender) this.renderDropZones();
            return;
        }

        // First check if there's setup data in the activity configuration
        if (this.currentActivity.setup && this.currentActivity.setup.dropZones && this.currentActivity.setup.dropZones.length > 0) {
            this.dropZones = this.currentActivity.setup.dropZones;
            console.log('Loaded drop zones from activity setup:', this.dropZones);
        } else {
            console.log('No setup data found, checking localStorage...');
            // Fall back to localStorage
            const savedZones = localStorage.getItem(`dropZones_${this.currentActivity.name}`);
            if (savedZones) {
                this.dropZones = JSON.parse(savedZones);
                console.log('Loaded drop zones from localStorage:', this.dropZones);
            } else {
                console.log('No localStorage data, creating default zones...');
                // Create empty default zones (no terms assigned yet)
                this.dropZones = this.currentActivity.terms.map((term, index) => ({
                    id: `zone-${index}`,
                    acceptedTerms: [],
                    minRequired: 1,
                    maxAllowed: 1,
                    x: 20 + (index * 15),
                    y: 20 + (index * 10),
                    width: 15,
                    height: 10
                }));
                console.log('Created default drop zones:', this.dropZones);
            }
        }
        
        // Convert legacy zones to new format (backward compatibility)
        this.convertLegacyZones();
        
        // Validate and correct zone positions
        this.validateZonePositions();
        
        // Ensure zones are properly synchronized between modes
        this.synchronizeZonePositions();
        
        // Update text fitting with current drop zones
        this.textFitting.updateDropZones(this.dropZones);
        
        if (!skipRender) this.renderDropZones();
    }

    convertLegacyZones() {
        this.dropZones.forEach(zone => {
            // Convert legacy zones that have 'term' property
            if (zone.term !== undefined) {
                // Convert to new format
                zone.acceptedTerms = zone.term ? [zone.term] : [];
                zone.minRequired = 1;
                zone.maxAllowed = 1;
                
                // Remove legacy property
                delete zone.term;
                
                console.log(`Converted legacy zone ${zone.id}:`, zone);
            }
            
            // Ensure all zones have the new properties
            if (!zone.acceptedTerms) zone.acceptedTerms = [];
            if (zone.minRequired === undefined) zone.minRequired = 1;
            if (zone.maxAllowed === undefined) zone.maxAllowed = 1;
        });
    }

    validateZonePositions() {
        // Get the current image element
        const imageElement = this.currentMode === 'teacher' ? this.activityImage : this.activityImageDisplay;
        
        if (!imageElement || !imageElement.complete) {
            // If image isn't loaded yet, use basic validation
            this.dropZones.forEach(zone => {
                zone.x = Math.max(0, Math.min(100, zone.x));
                zone.y = Math.max(0, Math.min(100, zone.y));
                zone.width = Math.max(5, Math.min(50, zone.width)); // Percentage-based limits
                zone.height = Math.max(5, Math.min(50, zone.height)); // Percentage-based limits
            });
            return;
        }
        
        // Wait for the image to be fully rendered
        const imageRect = imageElement.getBoundingClientRect();
        
        // If the image rect is not properly sized yet, wait a bit more
        if (imageRect.width === 0 || imageRect.height === 0) {
            setTimeout(() => this.validateZonePositions(), 50);
            return;
        }
        
        this.dropZones.forEach(zone => {
            // Normalize legacy zones saved with pixels
            if (zone.width > 100) {
                zone.width = (zone.width / imageRect.width) * 100;
            }
            if (zone.height > 100) {
                zone.height = (zone.height / imageRect.height) * 100;
            }
            
            // Ensure x and y are within 0-100 range
            zone.x = Math.max(0, Math.min(100, zone.x));
            zone.y = Math.max(0, Math.min(100, zone.y));
            
            // Ensure reasonable zone sizes (as percentages)
            zone.width = Math.max(5, Math.min(50, zone.width));
            zone.height = Math.max(5, Math.min(50, zone.height));
            
            // Ensure zones don't extend beyond image boundaries
            if (zone.x + zone.width > 100) {
                zone.x = 100 - zone.width;
            }
            if (zone.y + zone.height > 100) {
                zone.y = 100 - zone.height;
            }
        });
    }

    synchronizeZonePositions() {
        // Ensure all zones have consistent percentage-based positioning
        this.dropZones.forEach(zone => {
            // Round positions to 2 decimal places for consistency
            zone.x = Math.round(zone.x * 100) / 100;
            zone.y = Math.round(zone.y * 100) / 100;
            zone.width = Math.round(zone.width * 100) / 100;
            zone.height = Math.round(zone.height * 100) / 100;
            
            // Ensure all values are within valid ranges
            zone.x = Math.max(0, Math.min(100, zone.x));
            zone.y = Math.max(0, Math.min(100, zone.y));
            zone.width = Math.max(5, Math.min(50, zone.width));
            zone.height = Math.max(5, Math.min(50, zone.height));
        });
        
        console.log('Synchronized zone positions:', this.dropZones);
    }

    ensureConsistentImageDimensions() {
        // CSS now handles consistent image dimensions automatically
        // Both images use .image-container img styling which ensures they're the same size
        console.log('Image dimensions are now handled by CSS');
    }

    renderDropZones() {
        this.dropZonesContainer.innerHTML = '';
        this.dropZones.forEach(zone => this.createZoneElement(zone, true));
        this.updateTermAssignments();
    }

    createZoneElement(zone, isSetup = false) {
        const zoneElement = document.createElement('div');
        zoneElement.className = `drop-zone ${isSetup ? 'setup-zone' : ''}`;
        zoneElement.id = zone.id;
        
        // Store zone data for drag and drop logic
        zoneElement.dataset.zoneId = zone.id;
        
        // Ensure positioning is consistent and within bounds
        const x = Math.max(0, Math.min(100, zone.x));
        const y = Math.max(0, Math.min(100, zone.y));
        
        // Use percentage-based positioning for consistency
        zoneElement.style.left = `${x}%`;
        zoneElement.style.top = `${y}%`;
        zoneElement.style.width = `${zone.width}%`;
        zoneElement.style.height = `${zone.height}%`;
        
        // Ensure the zone is positioned relative to the image container
        zoneElement.style.position = 'absolute';
        
        if (isSetup) {
            zoneElement.addEventListener('click', () => this.selectZone(zone));
            this.makeZoneDraggable(zoneElement, zone);
            
            // Add resize handle for teacher mode
            const resizeHandle = document.createElement('div');
            resizeHandle.className = 'resize-handle';
            zoneElement.appendChild(resizeHandle);
            
            // Make resize handle functional
            this.makeZoneResizable(zoneElement, zone, resizeHandle);
        } else {
            // Create container for placed labels
            const placedLabelsContainer = document.createElement('div');
            placedLabelsContainer.className = 'placed-labels';
            zoneElement.appendChild(placedLabelsContainer);
        }

        // Append to the correct container based on mode
        const container = isSetup
            ? this.dropZonesContainer
            : this.activityDropZones;

        container.appendChild(zoneElement);
        return zoneElement;
    }


    makeZoneDraggable(zoneElement, zone) {
        let isDragging = false;
        let startX, startY, startLeft, startTop;

        zoneElement.addEventListener('mousedown', (e) => {
            // Don't start dragging if clicking on the resize handle
            if (e.target.classList.contains('resize-handle')) {
                return;
            }
            
            if (e.target === zoneElement) {
                isDragging = true;
                startX = e.clientX;
                startY = e.clientY;
                startLeft = parseFloat(zoneElement.style.left);
                startTop = parseFloat(zoneElement.style.top);
                
                zoneElement.style.cursor = 'grabbing';
                e.preventDefault();
            }
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Get the actual image element for precise positioning
            const imageElement = this.activityImage; // Always use teacher mode image for dragging
            const imageRect = imageElement.getBoundingClientRect();
            
            // Ensure we have valid dimensions
            if (imageRect.width === 0 || imageRect.height === 0) {
                return;
            }
            
            // Calculate new position as percentages relative to the actual image
            const newLeftPercent = ((startLeft * imageRect.width / 100) + deltaX) / imageRect.width * 100;
            const newTopPercent = ((startTop * imageRect.height / 100) + deltaY) / imageRect.height * 100;
            
            // Constrain to image bounds (accounting for zone size)
            const zoneWidthPercent = zone.width; // Already in percentage
            const zoneHeightPercent = zone.height; // Already in percentage
            
            const constrainedLeft = Math.max(0, Math.min(100 - zoneWidthPercent, newLeftPercent));
            const constrainedTop = Math.max(0, Math.min(100 - zoneHeightPercent, newTopPercent));
            
            zoneElement.style.left = `${constrainedLeft}%`;
            zoneElement.style.top = `${constrainedTop}%`;
            
            // Update zone data
            zone.x = constrainedLeft;
            zone.y = constrainedTop;
        });

        document.addEventListener('mouseup', () => {
            if (isDragging) {
                isDragging = false;
                zoneElement.style.cursor = 'move';
                this.saveDropZones();
            }
        });
    }

    makeZoneResizable(zoneElement, zone, resizeHandle) {
        let isResizing = false;
        let startX, startY, startWidth, startHeight;

        resizeHandle.addEventListener('mousedown', (e) => {
            e.stopPropagation(); // Prevent zone selection when clicking resize handle
            isResizing = true;
            startX = e.clientX;
            startY = e.clientY;
            startWidth = zone.width;
            startHeight = zone.height;
            
            resizeHandle.style.cursor = 'nw-resize';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isResizing) return;
            
            const deltaX = e.clientX - startX;
            const deltaY = e.clientY - startY;
            
            // Get the actual image element for precise sizing
            const imageElement = this.activityImage; // Always use teacher mode image for resizing
            const imageRect = imageElement.getBoundingClientRect();
            
            // Ensure we have valid dimensions
            if (imageRect.width === 0 || imageRect.height === 0) {
                return;
            }
            
            // Calculate new size as percentages relative to the actual image
            const deltaWidthPercent = (deltaX / imageRect.width) * 100;
            const deltaHeightPercent = (deltaY / imageRect.height) * 100;
            
            const newWidth = startWidth + deltaWidthPercent;
            const newHeight = startHeight + deltaHeightPercent;
            
            // Constrain to reasonable limits (5% to 50%)
            const constrainedWidth = Math.max(5, Math.min(50, newWidth));
            const constrainedHeight = Math.max(5, Math.min(50, newHeight));
            
            // Ensure zones don't extend beyond image boundaries
            const maxWidth = 100 - zone.x;
            const maxHeight = 100 - zone.y;
            const finalWidth = Math.min(constrainedWidth, maxWidth);
            const finalHeight = Math.min(constrainedHeight, maxHeight);
            
            // Update zone size
            zone.width = finalWidth;
            zone.height = finalHeight;
            
            // Update visual representation
            zoneElement.style.width = `${finalWidth}%`;
            zoneElement.style.height = `${finalHeight}%`;
        });

        document.addEventListener('mouseup', () => {
            if (isResizing) {
                isResizing = false;
                resizeHandle.style.cursor = 'nw-resize';
                this.saveDropZones();
                
                // Update configuration form if this zone is currently selected
                if (this.selectedZone && this.selectedZone.id === zone.id) {
                    this.zoneWidth.value = zone.width;
                    this.zoneHeight.value = zone.height;
                }
            }
        });
    }

    selectZone(zone) {
        // Deselect previous zone
        if (this.selectedZone) {
            const prevElement = document.getElementById(this.selectedZone.id);
            if (prevElement) prevElement.classList.remove('selected');
        }
        
        this.selectedZone = zone;
        const zoneElement = document.getElementById(zone.id);
        if (zoneElement) zoneElement.classList.add('selected');
        
        // Populate configuration form with zone data
        this.zoneMinRequired.value = zone.minRequired;
        
        // Handle maxAllowed and unlimited checkbox
        if (zone.maxAllowed === null) {
            this.zoneMaxAllowed.value = 1;
            this.zoneUnlimited.checked = true;
        } else {
            this.zoneMaxAllowed.value = zone.maxAllowed;
            this.zoneUnlimited.checked = false;
        }
        
        // Populate accepted terms checkboxes
        this.populateAcceptedTermsCheckboxes(zone.acceptedTerms);
        
        // Populate position and size fields
        this.zoneX.value = zone.x;
        this.zoneY.value = zone.y;
        this.zoneWidth.value = zone.width;
        this.zoneHeight.value = zone.height;
        
        
        this.zoneConfig.style.display = 'block';
    }

    populateAcceptedTermsCheckboxes(acceptedTerms) {
        const checkboxes = this.zoneAcceptedTerms.querySelectorAll('input[type="checkbox"]');
        checkboxes.forEach(checkbox => {
            checkbox.checked = acceptedTerms.includes(checkbox.value);
        });
    }


    addDropZone() {
        const newZone = {
            id: `zone-${Date.now()}`,
            acceptedTerms: [],
            minRequired: 1,
            maxAllowed: 1,
            decoy: false,
            x: 50,
            y: 50,
            width: 15,
            height: 10
        };
        
        this.dropZones.push(newZone);
        this.renderDropZones();
        this.selectZone(newZone);
    }

    saveZone() {
        if (!this.selectedZone) return;
        
        console.log('Saving zone:', this.selectedZone.id);
        
        // Get accepted terms from checkboxes
        const acceptedTerms = [];
        const checkboxes = this.zoneAcceptedTerms.querySelectorAll('input[type="checkbox"]:checked');
        checkboxes.forEach(checkbox => {
            acceptedTerms.push(checkbox.value);
        });
        
        // Get other configuration values
        const minRequired = parseInt(this.zoneMinRequired.value);
        const maxAllowed = this.zoneUnlimited.checked ? null : parseInt(this.zoneMaxAllowed.value);
        // Validate configuration
        if (acceptedTerms.length === 0) {
            this.showFeedback('Please select at least one accepted term for this zone.', 'error');
            return;
        }
        
        if (minRequired < 0) {
            this.showFeedback('Minimum required labels cannot be negative.', 'error');
            return;
        }
        
        if (maxAllowed !== null && maxAllowed < minRequired) {
            this.showFeedback('Maximum allowed labels must be greater than or equal to minimum required.', 'error');
            return;
        }
        
        // Update zone data
        this.selectedZone.acceptedTerms = acceptedTerms;
        this.selectedZone.minRequired = minRequired;
        this.selectedZone.maxAllowed = maxAllowed;
        this.selectedZone.x = parseFloat(this.zoneX.value);
        this.selectedZone.y = parseFloat(this.zoneY.value);
        this.selectedZone.width = parseFloat(this.zoneWidth.value);
        this.selectedZone.height = parseFloat(this.zoneHeight.value);
        
        console.log('Updated zone data:', this.selectedZone);
        
        this.renderDropZones();
        this.saveDropZones();
        this.zoneConfig.style.display = 'none';
        this.selectedZone = null;
    }

    cancelZoneEdit() {
        this.zoneConfig.style.display = 'none';
        if (this.selectedZone) {
            const zoneElement = document.getElementById(this.selectedZone.id);
            if (zoneElement) zoneElement.classList.remove('selected');
            this.selectedZone = null;
        }
    }

    deleteZone() {
        if (!this.selectedZone) return;
        
        this.dropZones = this.dropZones.filter(z => z.id !== this.selectedZone.id);
        this.renderDropZones();
        this.saveDropZones();
        this.zoneConfig.style.display = 'none';
        this.selectedZone = null;
    }

    resizeAllZones() {
        // Get the current width and height values from the input fields
        const newWidth = parseFloat(this.zoneWidth.value);
        const newHeight = parseFloat(this.zoneHeight.value);
        
        // Validate the input values
        if (isNaN(newWidth) || isNaN(newHeight)) {
            this.showFeedback('Please enter valid Width (%) and Height (%) values first.', 'error');
            return;
        }
        
        if (newWidth < 5 || newWidth > 50 || newHeight < 5 || newHeight > 50) {
            this.showFeedback('Width and Height must be between 5% and 50%.', 'error');
            return;
        }
        
        // Check if there are any zones to resize
        if (this.dropZones.length === 0) {
            this.showFeedback('No drop zones exist to resize.', 'error');
            return;
        }
        
        // Resize all zones to the new dimensions
        this.dropZones.forEach(zone => {
            zone.width = newWidth;
            zone.height = newHeight;
        });
        
        // Re-render the zones and save the changes
        this.renderDropZones();
        this.saveDropZones();
        
        // Show success feedback
        this.showFeedback(`All ${this.dropZones.length} drop zones resized to ${newWidth}% × ${newHeight}%.`, 'success');
    }

    clearAllTerms() {
        // Clear all term assignments but keep the zones
        this.dropZones.forEach(zone => {
            zone.acceptedTerms = [];
        });
        
        // Hide zone config if it's open
        this.zoneConfig.style.display = 'none';
        this.selectedZone = null;
        
        // Re-render and save
        this.renderDropZones();
        this.saveDropZones();
        
        // Show feedback
        this.showFeedback('All terms cleared. Zones remain in place.', 'success');
    }

    saveToFile() {
        if (!this.currentActivity) {
            this.showFeedback('No activity loaded. Please load an activity first.', 'error');
            return;
        }

        // Create the setup data with new schema
        const setupData = {
            activityName: this.currentActivity.name,
            dropZones: this.dropZones.map(zone => ({
                id: zone.id,
                acceptedTerms: zone.acceptedTerms,
                minRequired: zone.minRequired,
                maxAllowed: zone.maxAllowed,
                x: zone.x,
                y: zone.y,
                width: zone.width,
                height: zone.height
            })),
            savedAt: new Date().toISOString(),
            version: '2.0' // New version for multi-term zones
        };
        
        // Create and download the file
        const setupFileName = `${this.currentActivity.name}_setup.json`;
        const blob = new Blob([JSON.stringify(setupData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = setupFileName;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.showFeedback(`Setup saved to ${setupFileName}. Place this file in the Activities/${this.currentActivity.name}/ folder to make it permanent. The app will automatically load this setup data when you reload the activity.`, 'success');
    }

    switchToStudentMode() {
        console.log('Switching to student mode...');
        console.log('Current drop zones:', this.dropZones);
        
        // Validate zone configuration
        const validationErrors = this.validateZoneConfiguration();
        if (validationErrors.length > 0) {
            this.showFeedback(`Configuration errors: ${validationErrors.join(', ')}`, 'error');
            return;
        }
        
        // Get only the terms that are assigned to zones
        const assignedTerms = this.dropZones.flatMap(z => z.acceptedTerms);
        console.log('Assigned terms:', assignedTerms);
        
        if (assignedTerms.length === 0) {
            this.showFeedback('Please assign at least one term to a drop zone before switching to student mode.', 'error');
            return;
        }
        
        // Save current zone positions before switching
        this.saveDropZones();
        
        // Ensure zones are synchronized
        this.synchronizeZonePositions();
        
        console.log('Switching to student mode...');
        this.showStudentMode();
        this.showFeedback('Switched to Student Mode! Click "Start Activity" to begin.', 'success');
    }

    validateZoneConfiguration() {
        const errors = [];
        
        this.dropZones.forEach(zone => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) {
                return;
            }
            
            // Check if zone has accepted terms
            if (zone.acceptedTerms.length === 0) {
                errors.push(`Zone ${zone.id} has no accepted terms`);
                return;
            }
            
            // Check minRequired and maxAllowed
            if (zone.minRequired < 0) {
                errors.push(`Zone ${zone.id} has invalid minRequired: ${zone.minRequired}`);
            }
            
            if (zone.maxAllowed !== null && zone.maxAllowed < zone.minRequired) {
                errors.push(`Zone ${zone.id} has maxAllowed (${zone.maxAllowed}) less than minRequired (${zone.minRequired})`);
            }
        });
        
        return errors;
    }

    saveDropZones() {
        localStorage.setItem(`dropZones_${this.currentActivity.name}`, JSON.stringify(this.dropZones));
    }

    updateTermAssignments() {
        const assignedTerms = this.dropZones.flatMap(z => z.acceptedTerms);
        console.log('Updating term assignments. Assigned terms:', assignedTerms);
        
        const termItems = this.termsList.querySelectorAll('.term-item');
        
        termItems.forEach(item => {
            const term = item.dataset.term;
            if (assignedTerms.includes(term)) {
                item.classList.add('assigned');
                console.log(`Term "${term}" is assigned`);
            } else {
                item.classList.remove('assigned');
                console.log(`Term "${term}" is NOT assigned`);
            }
        });
        
        // Update the Switch to Student button state (in teacher mode)
        const hasAssignedTerms = assignedTerms.length > 0;
        if (this.switchToStudentBtn) {
            this.switchToStudentBtn.disabled = !hasAssignedTerms;
            this.switchToStudentBtn.style.opacity = hasAssignedTerms ? '1' : '0.5';
        }
        
        // Update the Clear Terms button state
        if (this.clearTermsBtn) {
            this.clearTermsBtn.disabled = assignedTerms.length === 0;
            this.clearTermsBtn.style.opacity = assignedTerms.length > 0 ? '1' : '0.5';
        }
    }

    startActivity() {
        console.log('Start Activity button clicked');
        
        // Start timer
        this.startTimer();
        
        // Reset activity state
        this.answerHandler.reset();
        this.isActivityActive = true;
        
        // Enable dragging on all labels
        const draggableLabels = this.labelsContainer.querySelectorAll('.draggable-label');
        draggableLabels.forEach(label => {
            label.draggable = true;
            label.style.opacity = '1';
        });
        
        // Hide the start activity button
        this.startActivityBtn.style.display = 'none';
        
        // Show submit button (can submit at any time now)
        this.answerHandler.showSubmitButton();
        
        console.log('Setting up drag and drop...');
        this.setupDragAndDrop();
        
        console.log('Updating progress...');
        this.answerHandler.updateProgress();
        
        // Show success feedback
        this.showFeedback('🎯 Activity started! Drag the labels to the correct zones. You can submit at any time.', 'success');
    }

    createActivityDropZones() {
        this.activityDropZones.innerHTML = '';
        
        this.dropZones.forEach(zone => {
            // Create all zones, including blank zones (zones with no accepted terms)
            const el = this.createZoneElement(zone, false);
            this.textFitting.layoutPlacedLabels(el, zone);
        });
        
        // After all zones are created, ensure they're all properly laid out
        setTimeout(() => {
            this.dropZones.forEach(zone => {
                const zoneElement = document.getElementById(zone.id);
                if (zoneElement) {
                    this.textFitting.layoutPlacedLabels(zoneElement, zone);
                }
            });
        }, 50);
    }

    createDraggableLabels() {
        console.log('🚀 createDraggableLabels() called');
        this.labelsContainer.innerHTML = '<h3>Terms to Place:</h3>';

        // Count how many zones expect each term (only from non-blank zones)
        const counts = {};
        this.dropZones
            .filter(zone => zone.acceptedTerms && zone.acceptedTerms.length > 0) // Only count terms from non-blank zones
            .flatMap(z => z.acceptedTerms)
            .forEach(term => { counts[term] = (counts[term] || 0) + 1; });

        // Determine desired order from any termOrdering metadata populated by the loader
        const ordering = (this.currentActivity && this.currentActivity.termOrdering) || null;
        const uniqueTermsUsed = Object.keys(counts);

        // fixed-top terms that are actually used
        const fixedTop = ordering ? ordering.fixedTop.filter(t => uniqueTermsUsed.includes(t)) : [];

        // Build the rest from clusters. If no ordering info, treat all remaining as one cluster.
        const clusters = ordering && Array.isArray(ordering.randomClusters) && ordering.randomClusters.length > 0
            ? ordering.randomClusters
            : [uniqueTermsUsed.filter(t => !fixedTop.includes(t))];

        const ordered = [...fixedTop];
        clusters.forEach(cluster => {
            // Use only terms that are actually used and not already included
            let terms = cluster.filter(t => uniqueTermsUsed.includes(t) && !ordered.includes(t));
            if (!(ordering && ordering.noShuffle)) {
                // shuffle within cluster
                for (let i = terms.length - 1; i > 0; i--) {
                    const j = Math.floor(Math.random() * (i + 1));
                    [terms[i], terms[j]] = [terms[j], terms[i]];
                }
            }
            ordered.push(...terms);
        });

        // Build one tile per unique term. If count > 1, it becomes multi-use.
        ordered.forEach((term) => {
            const count = counts[term];
            if (!count) return;
            const label = document.createElement('div');
            label.className = 'draggable-label';
            label.draggable = false; // enabled on Start
            label.dataset.label = term;

            if (count > 1) {
                label.dataset.multi = 'true';
                label.dataset.remaining = String(count);
                label.innerHTML = `
                    <span>${term}</span>
                    <span class="count-badge">${count}</span>
                `;
            } else {
                label.dataset.multi = 'false';
                label.innerHTML = `<span>${term}</span>`;
            }

            this.labelsContainer.appendChild(label);
        });

        // After all labels are created, shrink fonts to fit the fixed panel width
        // Use setTimeout to ensure DOM is fully rendered
        setTimeout(() => {
            this.textFitting.adjustDraggableLabelFontSizesPrecise(this.labelsContainer);
        }, 100);
    }


    setupDragAndDrop() {
        const draggableLabels = this.labelsContainer.querySelectorAll('.draggable-label');
        const dropZones = this.activityDropZones.querySelectorAll('.drop-zone');

        draggableLabels.forEach(label => {
            label.addEventListener('dragstart', (e) => this.handleDragStart(e));
            label.addEventListener('dragend', (e) => this.handleDragEnd(e));
        });

        dropZones.forEach(zone => {
            zone.addEventListener('dragover', (e) => this.handleDragOver(e));
            zone.addEventListener('dragenter', (e) => this.handleDragEnter(e));
            zone.addEventListener('dragleave', (e) => this.handleDragLeave(e));
            zone.addEventListener('drop', (e) => this.answerHandler.handleDrop(e));
        });
    }

    handleDragStart(e) {
        // Don't let already-used tiles start another drag
        if (e.target.classList.contains('placed') || e.target.draggable === false) {
            e.preventDefault();
            return;
        }

        // For multi-use tiles, also ensure there is remaining count (handled below)
        const isMulti = e.target.dataset.multi === 'true';
        if (isMulti) {
            const remaining = parseInt(e.target.dataset.remaining || '0', 10);
            if (remaining <= 0) {
                e.preventDefault();
                return;
            }
        }

        this.draggedElement = e.target;
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/html', e.target.outerHTML);
    }

    handleDragEnd(e) {
        e.target.classList.remove('dragging');
        this.draggedElement = null;
        
        const dropZones = this.activityDropZones.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            zone.classList.remove('highlight');
        });
    }

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    }

    handleDragEnter(e) {
        e.preventDefault();
        if (this.draggedElement && !this.draggedElement.classList.contains('placed')) {
            e.target.classList.add('highlight');
        }
    }

    handleDragLeave(e) {
        e.target.classList.remove('highlight');
    }

    startTimer() {
        this.activityStartTime = new Date();
        this.timerDisplay.textContent = '00:00';
        
        this.timerInterval = setInterval(() => {
            const now = new Date();
            const elapsed = Math.floor((now - this.activityStartTime) / 1000);
            const minutes = Math.floor(elapsed / 60);
            const seconds = elapsed % 60;
            this.timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }, 1000);
    }

    stopTimer() {
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        this.activityEndTime = new Date();
    }

    getActivityDuration() {
        if (!this.activityStartTime) return 0;
        
        const endTime = this.activityEndTime || new Date();
        return Math.floor((endTime - this.activityStartTime) / 1000);
    }

    showFeedback(message, type) {
        this.feedback.textContent = message;
        this.feedback.className = `feedback ${type}`;
        
        setTimeout(() => {
            this.feedback.textContent = '';
            this.feedback.className = 'feedback';
        }, 3000);
    }

    resetActivity() {
        // Stop timer if running
        if (this.isActivityActive) {
            this.stopTimer();
            this.isActivityActive = false;
        }
        
        this.answerHandler.reset();

        const draggableLabels = this.labelsContainer.querySelectorAll('.draggable-label');
        draggableLabels.forEach(label => {
            label.classList.remove('placed');
            label.draggable = false; // Reset to initial state
            
            // Reset multi-use tiles to their original count
            if (label.dataset.multi === 'true') {
                const originalCount = this.dropZones.filter(z => z.acceptedTerms && z.acceptedTerms.length > 0 && z.acceptedTerms.includes(label.dataset.label)).length;
                label.dataset.remaining = String(originalCount);
                const badge = label.querySelector('.count-badge');
                if (badge) badge.textContent = String(originalCount);
            }
        });

        const dropZones = this.activityDropZones.querySelectorAll('.drop-zone');
        dropZones.forEach(zone => {
            zone.classList.remove('correct', 'incorrect', 'highlight');
            const placedLabels = zone.querySelectorAll('.placed-label');
            placedLabels.forEach(label => {
                label.remove();
            });
        });

        // Reset timer display
        this.timerDisplay.textContent = '00:00';
        
        // Hide submit button, also make sure it's re-enabled and label reset
        this.answerHandler.hideSubmitButton();
        this.submitScoreBtn.disabled = false;
        this.submitScoreBtn.textContent = 'Submit Score';
        
        // Show start activity button again
        this.startActivityBtn.style.display = 'inline-block';

        this.answerHandler.updateProgress();
        this.feedback.textContent = '';
        this.feedback.className = 'feedback';
        this.showFeedback('Activity reset! Click "Start Activity" to begin again.', 'success');
    }

    backToSelectionFromStudent() {
        // This method preserves the student name when going back to selection
        this.showSelectionMode();
        this.showFeedback('Returned to activity selection. Your name is preserved.', 'success');
    }

    checkTeacherPassword() {
        const inputPassword = this.teacherPasswordInput.value;
        if (inputPassword === this.teacherPassword) {
            this.isTeacherModeUnlocked = true;
            this.showFeedback('Teacher mode unlocked!', 'success');
            this.hidePasswordModal();
            this.showTeacherMode();
        } else {
            this.showFeedback('Incorrect password. Please try again.', 'error');
            this.teacherPasswordInput.value = ''; // Clear input on error
        }
    }

    hidePasswordModal() {
        this.passwordModal.style.display = 'none';
    }

    // NEW: fully clear student UI state (submit button, status, feedback, progress, timer)
    resetUIState() {
        // Reset counters and in-memory flags
        this.answerHandler.reset();
        this.isActivityActive = false;

        // Timer
        if (this.timerInterval) {
            clearInterval(this.timerInterval);
            this.timerInterval = null;
        }
        if (this.timerDisplay) this.timerDisplay.textContent = '00:00';

        // Labels & zones
        if (this.labelsContainer) this.labelsContainer.innerHTML = '<h3>Terms to Place:</h3>';
        if (this.activityDropZones) this.activityDropZones.innerHTML = '';

        // Progress
        if (this.progressFill) this.progressFill.style.width = '0%';
        if (this.progressText) this.progressText.textContent = 'Terms correct: 0 / 0';

        // Feedback (temporary banner)
        if (this.feedback) {
            this.feedback.textContent = '';
            this.feedback.className = 'feedback';
        }

        // Submit Score button
        if (this.submitScoreBtn) {
            this.answerHandler.hideSubmitButton();
            this.submitScoreBtn.disabled = false;
            this.submitScoreBtn.textContent = 'Submit Score';
        }

        // Permanent submission note (clear it between runs/activities)
        const status = document.getElementById('submission-status');
        if (status && status.parentNode) status.parentNode.removeChild(status);

        // Start button visible again
        if (this.startActivityBtn) this.startActivityBtn.style.display = 'inline-block';
    }



}

// Zoom and pan functionality
const zoomLevels = {};
const panOffsets = {};
let isPanning = false, startX, startY;

function zoomImage(direction, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (!zoomLevels[containerId]) zoomLevels[containerId] = 1;
    if (!panOffsets[containerId]) panOffsets[containerId] = { x: 0, y: 0 };

    if (direction === 'in') zoomLevels[containerId] += 0.1;
    if (direction === 'out') zoomLevels[containerId] = Math.max(0.5, zoomLevels[containerId] - 0.1); // allow down to 0.5x

    applyZoomAndPan(containerId);
}

function resetZoom(containerId) {
    zoomLevels[containerId] = 1;
    panOffsets[containerId] = { x: 0, y: 0 };
    applyZoomAndPan(containerId);
}

function applyZoomAndPan(containerId) {
    const container = document.getElementById(containerId);
    const scale = zoomLevels[containerId];
    const offset = panOffsets[containerId];

    container.style.transform = `scale(${scale}) translate(${offset.x}px, ${offset.y}px)`;
    container.style.transformOrigin = 'top left';

    if (scale > 1) {
        container.classList.add('zoomed');
    } else {
        container.classList.remove('zoomed');
    }
}

// Panning logic
document.addEventListener('mousedown', e => {
    const container = e.target.closest('.image-container.zoomed');
    if (!container) return;

    isPanning = true;
    startX = e.clientX;
    startY = e.clientY;
    container.dataset.panId = container.id;
    e.preventDefault();
});

document.addEventListener('mousemove', e => {
    if (!isPanning) return;
    const containerId = document.querySelector('.image-container.zoomed')?.dataset.panId;
    const offset = panOffsets[containerId];
    offset.x += e.clientX - startX;
    offset.y += e.clientY - startY;
    startX = e.clientX;
    startY = e.clientY;
    applyZoomAndPan(containerId);
});

document.addEventListener('mouseup', () => {
    isPanning = false;
});

// Keyboard shortcut: Escape resets zoom/pan and cancels panning
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        const container = document.getElementById('shared-image-container');
        if (!container) return;
        const id = container.id;
        const currentScale = zoomLevels[id] || 1;
        if (currentScale !== 1 || container.classList.contains('zoomed')) {
            isPanning = false;
            resetZoom(id);
        }
    }
});

// Initialize the app when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new DynamicDragDropActivity();
});

console.log('Dynamic Drag and Drop Activity App loaded successfully!');
console.log('Features:');
console.log('- Dynamic activity loading from Activities folder');
console.log('- Setup mode for configuring drop zones');
console.log('- Drag and drop functionality');
console.log('- Progress tracking and feedback');
console.log('- Local storage for saving zone configurations');
console.log('- Google Form score submission'); 