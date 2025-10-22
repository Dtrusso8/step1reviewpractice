// Activity Loader Utility
// This script loads activities from the activities.json file
// Simplified for local servers and GitHub pages

class ActivityLoader {
    constructor() {
        this.activities = [];
        console.log('ActivityLoader initialized');
    }

    async scanActivitiesFolder() {
        console.log('Starting scanActivitiesFolder...');
        try {
            // Load activities directly from the JSON file
            const activities = await this.loadActivitiesFromJSON();
            console.log('Activities loaded successfully:', activities);
            return activities;
        } catch (error) {
            console.error('Error in scanActivitiesFolder:', error);
            return [];
        }
    }

    async loadActivitiesFromJSON() {
        console.log('Starting loadActivitiesFromJSON...');
        try {
            // Load using XMLHttpRequest which works better with local servers
            return new Promise((resolve, reject) => {
                console.log('Creating XMLHttpRequest for activities.json...');
                const xhr = new XMLHttpRequest();
                xhr.open('GET', 'activities.json', true);
                
                xhr.onreadystatechange = function() {
                    console.log('XHR state changed:', xhr.readyState, 'status:', xhr.status);
                    if (xhr.readyState === 4) {
                        if (xhr.status === 200) {
                            try {
                                console.log('XHR response received, length:', xhr.responseText.length);
                                console.log('XHR response preview:', xhr.responseText.substring(0, 500));
                                const data = JSON.parse(xhr.responseText);
                                console.log('Parsed activities data:', data);
                                console.log('Activities array length:', data.activities.length);
                                console.log('Activities array:', data.activities);
                                
                                // Expose top-level passwords toggle globally
                                try {
                                    if (typeof window !== 'undefined') {
                                        window.PASSWORDS_ENABLED = data.passwordsEnabled === true;
                                    }
                                } catch (e) {
                                    console.warn('Could not set PASSWORDS_ENABLED on window.', e);
                                }
                                
                                // Process each activity to add terms and setup data
                                console.log('Starting to process activities...');
                                const processedActivities = data.activities.map((activity, index) => {
                                    console.log(`Processing activity ${index + 1}/${data.activities.length}:`, activity.name);
                                    // For now, we'll load terms and setup data when needed
                                    // This avoids the file loading issues
                                    return {
                                        ...activity,
                                        terms: [], // Will be loaded when activity is selected
                                        setup: { dropZones: [] } // Default empty setup
                                    };
                                });
                                
                                console.log('Processed activities count:', processedActivities.length);
                                console.log('Processed activities:', processedActivities);
                                resolve(processedActivities);
                            } catch (e) {
                                console.error('Error parsing activities.json:', e);
                                console.error('Response text:', xhr.responseText);
                                reject(e);
                            }
                        } else {
                            console.error('Failed to load activities.json:', xhr.status);
                            console.error('Status text:', xhr.statusText);
                            reject(new Error(`Failed to load activities.json: ${xhr.status}`));
                        }
                    }
                };
                
                xhr.onerror = function() {
                    console.error('Network error loading activities.json');
                    reject(new Error('Network error loading activities.json'));
                };
                
                console.log('Sending XHR request...');
                xhr.send();
            });
        } catch (error) {
            console.error('Error in loadActivitiesFromJSON:', error);
            throw error;
        }
    }

    // This method will be called when an activity is selected to load its terms
    async loadTermsForActivity(activity) {
        console.log('Loading terms for activity:', activity.name);
        if (!activity.termsFile) {
            console.log(`No terms file configured for ${activity.name}`);
            return [];
        }
        
        try {
            const termsText = await this.loadFileAsText(activity.termsFile);

            // Parse sections and directives from terms.txt
            const fixedTop = [];
            const randomClusters = [[]]; // start with a default cluster for unheaded/random lines
            const seen = new Set();
            let currentSection = 'random';
            let currentClusterIndex = 0;
            let noShuffle = false;

            termsText.split('\n').forEach(rawLine => {
                const line = rawLine.trim();
                if (!line) return; // skip blanks

                if (line === '@no-shuffle') { // directive to disable shuffling for this activity
                    noShuffle = true;
                    return;
                }

                if (line.startsWith('[') && line.endsWith(']')) {
                    const section = line.slice(1, -1).toLowerCase();
                    if (section === 'fixed-top') {
                        currentSection = 'fixed-top';
                    } else if (section === 'random') {
                        currentSection = 'random';
                        // start a new random cluster
                        randomClusters.push([]);
                        currentClusterIndex = randomClusters.length - 1;
                    } else {
                        // unknown section -> treat as random, new cluster
                        currentSection = 'random';
                        randomClusters.push([]);
                        currentClusterIndex = randomClusters.length - 1;
                    }
                    return;
                }

                // de-duplicate while preserving first occurrence order
                if (seen.has(line)) return;
                seen.add(line);

                if (currentSection === 'fixed-top') {
                    fixedTop.push(line);
                } else {
                    // ensure at least one cluster exists
                    if (randomClusters.length === 0) randomClusters.push([]);
                    // if we haven't hit a [random] header yet, use the default first cluster (index 0)
                    const idx = currentClusterIndex || 0;
                    randomClusters[idx].push(line);
                }
            });

            // Remove any empty clusters
            const nonEmptyClusters = randomClusters.filter(cluster => cluster.length > 0);

            const terms = [
                ...fixedTop,
                ...nonEmptyClusters.flat()
            ];

            // Store ordering metadata on the activity object for downstream use
            activity.termOrdering = { fixedTop, randomClusters: nonEmptyClusters, noShuffle };

            console.log(`Loaded ${terms.length} terms for ${activity.name}:`, terms);
            return terms;
        } catch (error) {
            console.error(`Error loading terms for ${activity.name}:`, error);
            return [];
        }
    }

    // This method will be called when an activity is selected to load its setup
    async loadSetupForActivity(activity) {
        console.log('Loading setup for activity:', activity.name);
        if (!activity.setupFile) {
            console.log(`No setup file configured for ${activity.name}`);
            return { dropZones: [] };
        }
        
        try {
            const setupText = await this.loadFileAsText(activity.setupFile);
            const setupData = JSON.parse(setupText);
            console.log(`Loaded setup for ${activity.name}:`, setupData);
            return setupData;
        } catch (error) {
            console.log(`No setup file found for ${activity.name} or error loading it, using empty setup`);
            return { dropZones: [] };
        }
    }

    async loadFileAsText(filePath) {
        console.log('Loading file as text:', filePath);
        return new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('GET', filePath, true);
            xhr.onreadystatechange = function() {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        console.log('File loaded successfully:', filePath);
                        resolve(xhr.responseText);
                    } else {
                        console.error(`Failed to load ${filePath}:`, xhr.status);
                        reject(new Error(`Failed to load ${filePath}: ${xhr.status}`));
                    }
                }
            };
            xhr.onerror = function() {
                console.error(`Network error loading ${filePath}`);
                reject(new Error(`Network error loading ${filePath}`));
            };
            xhr.send();
        });
    }
}

// Instructions for adding new activities:
/*
To add a new activity:

1. Create a new folder in the Activities directory with the activity name
2. Add an image file (jpg, png, etc.) to the folder
3. Create a terms.txt file with one term per line
4. Add an entry to activities.json with the correct file paths
5. The activity will be automatically detected and loaded!

Example folder structure:
Activities/
  your-activity-name/
    image.jpg (or any image file)
    terms.txt
    your-activity-name_setup.json (optional - created when you save setup)

Example activities.json entry:
{
  "name": "your-activity-name",
  "displayName": "Your Activity Display Name",
  "image": "Activities/your-activity-name/image.jpg",
  "termsFile": "Activities/your-activity-name/terms.txt"
}
*/

// Export for use in the main script
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ActivityLoader;
} 