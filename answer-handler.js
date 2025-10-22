// Answer Handler Module - Handles all logic related to correct/incorrect term placements,
// progress tracking, score calculation, and submission
class AnswerHandler {
    constructor(mainApp) {
        this.mainApp = mainApp;
        this.correctPlacements = 0;
        
        // Answer validation mode: 'strict' (default) or 'permissive'
        // In permissive mode, incorrect answers are accepted without visual feedback
        this.validationMode = 'permissive';
        
        // Score submission configuration
        this.scoreSubmissionConfig = {
            enabled: true,
            googleFormUrl: 'https://script.google.com/macros/s/AKfycbywMI1iJsXObD2MwCZhtqcdhHLIHHUSbqvQkLZUaPN4RdWgTxF1d6JP4qSLGeDD_uY/exec',
            fallback: {
                showInConsole: true,
                createDownloadableReport: true,
                showAlert: false
            }
        };
        
        // Testing: allow multiple submissions (hide briefly, allow multiple)
        this.multiSubmitTesting = true;
    }

    // Handle drop events and validate placements
    handleDrop(e) {
        e.preventDefault();
        e.target.classList.remove('highlight');

        if (!this.mainApp.draggedElement) return;

        const labelType = this.mainApp.draggedElement.dataset.label;
        const zoneElement = e.target.closest('.drop-zone');
        
        if (!zoneElement) return;
        
        const zoneId = zoneElement.dataset.zoneId;
        const zone = this.mainApp.dropZones.find(z => z.id === zoneId);
        
        if (!zone) return;

        if (this.mainApp.draggedElement.classList.contains('placed')) {
            this.mainApp.showFeedback('This label has already been placed!', 'error');
            return;
        }


        // Check if zone has reached maximum capacity
        const placedLabels = zoneElement.querySelectorAll('.placed-label');
        const currentCount = placedLabels.length;
        
        if (zone.maxAllowed !== null && currentCount >= zone.maxAllowed) {
            this.mainApp.showFeedback(`Maximum ${zone.maxAllowed} labels allowed in this zone.`, 'error');
            return;
        }

        // Check if the term is accepted in this zone
        if (!zone.acceptedTerms.includes(labelType)) {
            // In permissive mode, accept incorrect answers without visual feedback
            if (this.validationMode === 'permissive') {
                this.handlePermissivePlacement(zoneElement, this.mainApp.draggedElement, zone);
                return;
            } else {
                // In strict mode, show error feedback
                this.mainApp.showFeedback(`Incorrect! ${labelType} doesn't belong in this zone.`, 'error');
                return;
            }
        }

        // Handle correct placement
        if (this.validationMode === 'permissive') {
            // In permissive mode, handle correct placements silently too
            this.handlePermissivePlacement(zoneElement, this.mainApp.draggedElement, zone);
        } else {
            // In strict mode, show normal feedback for correct placements
            this.handleCorrectPlacement(zoneElement, this.mainApp.draggedElement, zone);
        }
    }

    // Handle correct term placement
    handleCorrectPlacement(dropZone, label, zone) {
        // Make a placed copy for the zone
        const placedLabel = label.cloneNode(true);
        placedLabel.classList.remove('dragging');
        placedLabel.classList.add('placed-label');
        placedLabel.draggable = false;

        // A multi-use sidebar tile shows a count badge; strip it from the placed copy
        const badge = placedLabel.querySelector('.count-badge');
        if (badge) badge.remove();

        // mark the text span so CSS can target it
        const txt = placedLabel.querySelector('span');
        if (txt) txt.classList.add('label-text');

        // Add remove button (overlay, not in flow)
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-label-btn';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => this.removePlacedLabel(placedLabel, label, zone));
        placedLabel.appendChild(removeBtn);

        // Add to the placed labels container
        const placedLabelsContainer = dropZone.querySelector('.placed-labels');
        placedLabelsContainer.appendChild(placedLabel);
        
        // Layout rows + fit the label to *its own cell*
        this.mainApp.textFitting.layoutPlacedLabels(dropZone, zone);

        // Update zone appearance
        dropZone.classList.add('correct', 'correct-placement');

        const isMulti = label.dataset.multi === 'true';
        if (isMulti) {
            // Decrement remaining, disable tile when it hits zero
            let remaining = parseInt(label.dataset.remaining || '0', 10);
            remaining = Math.max(0, remaining - 1);
            label.dataset.remaining = String(remaining);
            const tileBadge = label.querySelector('.count-badge');
            if (tileBadge) tileBadge.textContent = String(remaining);
            if (remaining === 0) {
                label.classList.add('placed');
                label.draggable = false;
            }
        } else {
            // Single-use tiles are consumed after a correct placement
            label.classList.add('placed');
            label.draggable = false;
        }

        this.correctPlacements++;
        this.updateProgress();

        this.mainApp.showFeedback(`Correct! ${label.querySelector('span').textContent} is in the right place!`, 'success');

        // Check if all zones are complete
        if (this.checkAllZonesComplete()) {
            this.completeActivity();
        }

        setTimeout(() => {
            dropZone.classList.remove('correct-placement');
        }, 500);
    }

    // Handle incorrect term placement
    handleIncorrectPlacement(dropZone, label) {
        dropZone.classList.add('incorrect');
        this.mainApp.showFeedback(`Incorrect! ${label.querySelector('span').textContent} doesn't belong there.`, 'error');

        setTimeout(() => {
            dropZone.classList.remove('incorrect');
        }, 500);
    }

    // Handle permissive placement (all answers accepted without visual feedback)
    handlePermissivePlacement(dropZone, label, zone) {
        // Check if this is a correct placement
        const labelType = label.dataset.label;
        const isCorrect = zone.acceptedTerms.includes(labelType);
        
        // Make a placed copy for the zone (same as correct placement)
        const placedLabel = label.cloneNode(true);
        placedLabel.classList.remove('dragging');
        placedLabel.classList.add('placed-label');
        placedLabel.draggable = false;

        // Store whether this placement was correct for later scoring
        placedLabel.dataset.isCorrect = isCorrect.toString();

        // A multi-use sidebar tile shows a count badge; strip it from the placed copy
        const badge = placedLabel.querySelector('.count-badge');
        if (badge) badge.remove();

        // mark the text span so CSS can target it
        const txt = placedLabel.querySelector('span');
        if (txt) txt.classList.add('label-text');

        // Add remove button (overlay, not in flow)
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-label-btn';
        removeBtn.textContent = '✕';
        removeBtn.addEventListener('click', () => this.removePlacedLabel(placedLabel, label, zone));
        placedLabel.appendChild(removeBtn);

        // Add to the placed labels container
        const placedLabelsContainer = dropZone.querySelector('.placed-labels');
        placedLabelsContainer.appendChild(placedLabel);
        
        // Layout rows + fit the label to *its own cell*
        this.mainApp.textFitting.layoutPlacedLabels(dropZone, zone);

        // NO visual feedback - no "correct" styling, no success message
        // The label is placed but doesn't count toward progress until submission

        const isMulti = label.dataset.multi === 'true';
        if (isMulti) {
            // Decrement remaining, disable tile when it hits zero
            let remaining = parseInt(label.dataset.remaining || '0', 10);
            remaining = Math.max(0, remaining - 1);
            label.dataset.remaining = String(remaining);
            const tileBadge = label.querySelector('.count-badge');
            if (tileBadge) tileBadge.textContent = String(remaining);
            if (remaining === 0) {
                label.classList.add('placed');
                label.draggable = false;
            }
        } else {
            // Single-use tiles are consumed after placement
            label.classList.add('placed');
            label.draggable = false;
        }

        // NO progress update - placements don't count toward score until submission
        // NO completion check - placements don't contribute to completion until submission
    }

    // Remove a placed label
    removePlacedLabel(placedLabel, originalLabel, zone) {
        // Remove the placed label
        placedLabel.remove();
        
        // Update zone appearance
        const dropZone = placedLabel.closest('.drop-zone');
        if (dropZone) {
            dropZone.classList.remove('correct');
            this.mainApp.textFitting.layoutPlacedLabels(dropZone, zone);
        }
        
        // Restore the original label if it was bounded
        if (originalLabel.dataset.multi === 'true') {
            let remaining = parseInt(originalLabel.dataset.remaining || '0', 10);
            remaining = Math.min(remaining + 1, this.mainApp.dropZones.filter(z => z.acceptedTerms.includes(originalLabel.dataset.label)).length);
            originalLabel.dataset.remaining = String(remaining);
            
            const tileBadge = originalLabel.querySelector('.count-badge');
            if (tileBadge) tileBadge.textContent = String(remaining);
            
            if (remaining > 0) {
                originalLabel.classList.remove('placed');
                originalLabel.draggable = true;
            }
        } else {
            // Single-use tiles are restored
            originalLabel.classList.remove('placed');
            originalLabel.draggable = true;
        }
        
        // Update progress counter but don't update display until submit
        this.correctPlacements = Math.max(0, this.correctPlacements - 1);
        
        this.mainApp.showFeedback(`Removed ${originalLabel.querySelector('span').textContent} from zone.`, 'info');
    }

    // Update progress bar and text
    updateProgress() {
        // Term-level progress across non-blank zones
        const totalExpected = this.calculateTotalExpectedLabels();
        const placedCorrect = this.calculatePlacedLabels();
        const percentage = totalExpected > 0 ? (placedCorrect / totalExpected) * 100 : 0;
        this.mainApp.progressFill.style.width = `${percentage}%`;
        this.mainApp.progressText.textContent = `Terms correct: ${placedCorrect} / ${totalExpected}`;
        this.correctPlacements = placedCorrect;
    }

    // Calculate total expected labels (excluding blank zones)
    calculateTotalExpectedLabels() {
        return this.mainApp.dropZones.reduce((sum, zone) => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return sum;
            // Prefer explicit maxAllowed when finite; otherwise, use number of accepted terms.
            if (zone.maxAllowed === null) {
                return sum + (Array.isArray(zone.acceptedTerms) ? zone.acceptedTerms.length : 0);
            }
            return sum + (typeof zone.maxAllowed === 'number' ? zone.maxAllowed : 0);
        }, 0);
    }

    // Count correctly placed labels across non-blank zones respecting max/min and accepted terms
    calculatePlacedLabels() {
        let placed = 0;
        this.mainApp.dropZones.forEach(zone => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return;
            const zoneElement = document.getElementById(zone.id);
            if (!zoneElement) return;
            const placedLabels = Array.from(zoneElement.querySelectorAll('.placed-label'));
            
            if (this.validationMode === 'permissive') {
                // In permissive mode, use the stored isCorrect flag
                const correctPlaced = placedLabels.filter(label => {
                    return label.dataset.isCorrect === 'true';
                });
                // Respect maxAllowed when finite
                const cap = zone.maxAllowed === null ? Infinity : zone.maxAllowed;
                placed += Math.min(correctPlaced.length, cap);
            } else {
                // In strict mode, filter to accepted terms only
                const acceptedPlaced = placedLabels.filter(label => {
                    const term = label.querySelector('span')?.textContent || '';
                    return zone.acceptedTerms.includes(term);
                });
                // Respect maxAllowed when finite
                const cap = zone.maxAllowed === null ? Infinity : zone.maxAllowed;
                placed += Math.min(acceptedPlaced.length, cap);
            }
        });
        return placed;
    }

    // Calculate correct zones (excluding blank zones)
    calculateCorrectZones() {
        // Count correct zones for actual drop zones only (exclude blank zones)
        let correctZones = 0;
        
        this.mainApp.dropZones.forEach(zone => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return;
            
            // Regular zones are correct when they meet requirements
            const zoneElement = document.getElementById(zone.id);
            if (zoneElement) {
                const placedLabels = zoneElement.querySelectorAll('.placed-label');
                const placedCount = placedLabels.length;
                
                // Check if all placed terms are accepted
                const allTermsAccepted = Array.from(placedLabels).every(label => {
                    const term = label.querySelector('span').textContent;
                    return zone.acceptedTerms.includes(term);
                });
                
                // Check if count meets requirements
                const meetsMin = placedCount >= zone.minRequired;
                const meetsMax = zone.maxAllowed === null || placedCount <= zone.maxAllowed;
                
                if (allTermsAccepted && meetsMin && meetsMax) {
                    correctZones++;
                }
            }
        });
        
        return correctZones;
    }

    // Check if all zones are complete
    checkAllZonesComplete() {
        return this.mainApp.dropZones.every(zone => {
            // Skip zones with no accepted terms (blank zones) - they are always considered complete
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return true;
            
            // Regular zones should meet their requirements
            const zoneElement = document.getElementById(zone.id);
            if (zoneElement) {
                const placedLabels = zoneElement.querySelectorAll('.placed-label');
                const placedCount = placedLabels.length;
                
                // Check if all placed terms are accepted
                const allTermsAccepted = Array.from(placedLabels).every(label => {
                    const term = label.querySelector('span').textContent;
                    return zone.acceptedTerms.includes(term);
                });
                
                // Check if count meets requirements
                const meetsMin = placedCount >= zone.minRequired;
                const meetsMax = zone.maxAllowed === null || placedCount <= zone.maxAllowed;
                
                return allTermsAccepted && meetsMin && meetsMax;
            }
            return false;
        });
    }

    // Complete the activity
    completeActivity() {
        // Stop the timer
        this.mainApp.stopTimer();
        this.mainApp.isActivityActive = false;
        
        // Show completion message
        setTimeout(() => {
            this.mainApp.showFeedback('🎉 Congratulations! You\'ve completed the activity! 🎉', 'complete');
            
            // Show submit button
            this.mainApp.submitScoreBtn.style.display = 'inline-block';
        }, 1000);
    }

    // Show submit button (can be called at any time)
    showSubmitButton() {
        this.mainApp.submitScoreBtn.style.display = 'inline-block';
    }

    // Hide submit button
    hideSubmitButton() {
        this.mainApp.submitScoreBtn.style.display = 'none';
    }

    // Show visual feedback for permissive mode submissions (green/red borders)
    showPermissiveModeFeedback() {
        console.log('🎨 Showing permissive mode feedback');
        
        this.mainApp.dropZones.forEach(zone => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return;
            
            const zoneElement = document.getElementById(zone.id);
            if (!zoneElement) return;
            
            const placedLabels = Array.from(zoneElement.querySelectorAll('.placed-label'));
            if (placedLabels.length === 0) return; // Skip empty zones
            
            // Check if all placed terms are correct
            const allTermsCorrect = placedLabels.every(label => {
                return label.dataset.isCorrect === 'true';
            });
            
            // Check if count meets requirements
            const placedCount = placedLabels.length;
            const meetsMin = placedCount >= zone.minRequired;
            const meetsMax = zone.maxAllowed === null || placedCount <= zone.maxAllowed;
            
            // Apply visual feedback
            if (allTermsCorrect && meetsMin && meetsMax) {
                // All correct - strong green border
                zoneElement.style.border = '4px solid #28a745';
                zoneElement.style.backgroundColor = 'rgba(40, 167, 69, 0.1)';
                console.log(`✅ Zone ${zone.id}: All correct - GREEN`);
            } else {
                // Some incorrect - strong red border
                zoneElement.style.border = '4px solid #dc3545';
                zoneElement.style.backgroundColor = 'rgba(220, 53, 69, 0.1)';
                console.log(`❌ Zone ${zone.id}: Some incorrect - RED`);
            }
            
            // Add individual label feedback
            placedLabels.forEach(label => {
                const isCorrect = label.dataset.isCorrect === 'true';
                
                if (isCorrect) {
                    label.style.border = '2px solid #28a745';
                    label.style.backgroundColor = 'rgba(40, 167, 69, 0.2)';
                } else {
                    label.style.border = '2px solid #dc3545';
                    label.style.backgroundColor = 'rgba(220, 53, 69, 0.2)';
                }
            });
        });
        
        // Show feedback message
        this.mainApp.showFeedback('📊 Visual feedback shown: Green = Correct, Red = Incorrect', 'info');
    }

    // Submit score to Google Sheets and handle fallback
    submitScore() {
        // Stop the timer when submitting
        this.mainApp.stopTimer();
        this.mainApp.isActivityActive = false;
        
        // Calculate score based on total expected labels (exclude blank zones)
        const totalExpectedLabels = this.calculateTotalExpectedLabels();
        const placedCorrectLabels = this.calculatePlacedLabels();
        const percentage = totalExpectedLabels > 0
            ? Math.round((placedCorrectLabels / totalExpectedLabels) * 100)
            : 0;
        
        const scoreData = {
            studentName: this.mainApp.studentName,
            assignmentName: this.mainApp.currentActivity.displayName,
            score: placedCorrectLabels,
            totalLabels: totalExpectedLabels,
            percentage: percentage,
            timer: this.mainApp.getActivityDuration(),
            timeSubmitted: new Date().toISOString(),
            activityName: this.mainApp.currentActivity.name,
            activityStartTime: this.mainApp.activityStartTime ? this.mainApp.activityStartTime.toISOString() : null,
            activityEndTime: this.mainApp.activityEndTime ? this.mainApp.activityEndTime.toISOString() : null,
            completedAt: new Date().toISOString(),
            durationFormatted: `${Math.floor(this.mainApp.getActivityDuration() / 60)}:${(this.mainApp.getActivityDuration() % 60).toString().padStart(2, '0')}`
        };

        // Show visual feedback for permissive mode submissions
        if (this.validationMode === 'permissive') {
            this.showPermissiveModeFeedback();
            // Update progress bar to show final score
            this.updateProgress();
        }

        // Optional: brief banner is fine, but not required
        this.mainApp.showFeedback(
            `Submitting: ${scoreData.score}/${scoreData.totalLabels} terms correct (${scoreData.percentage}%) in ${scoreData.durationFormatted}`,
            'success'
        );

        // Send to Google Sheet
        this.submitToGoogleSheet(scoreData.studentName, scoreData.score, scoreData.timer);

        // PERMANENT confirmation near the button
        this.showSubmissionStatus({
            studentName: scoreData.studentName,
            timeSubmittedISO: scoreData.timeSubmitted,
            durationFormatted: scoreData.durationFormatted,
            score: scoreData.score,
            totalLabels: scoreData.totalLabels
        });

        // Disable/hide behavior based on testing flag
        if (!this.multiSubmitTesting) {
            // Original behavior: disable to prevent double submission
            this.mainApp.submitScoreBtn.disabled = true;
            this.mainApp.submitScoreBtn.textContent = 'Score Submitted';
        } else {
            // Testing behavior: briefly hide then re-enable for repeated submits
            const btn = this.mainApp.submitScoreBtn;
            btn.style.display = 'none';
            setTimeout(() => {
                btn.style.display = 'inline-block';
                btn.disabled = false;
                btn.textContent = 'Submit Score';
            }, 1000);
        }

        // Local fallback + download
        this.handleScoreSubmissionFallback(scoreData);
    }

    // Submit to Google Sheet
    submitToGoogleSheet(studentName, quizScore, duration) {
        // Calculate percentage based on total expected labels (exclude blank zones)
        const totalExpectedLabels = this.calculateTotalExpectedLabels();
        const percentage = totalExpectedLabels > 0
            ? Math.round((quizScore / totalExpectedLabels) * 100)
            : 0;
        
        // Convert duration from seconds to minutes
        const durationMinutes = Math.round((duration / 60) * 100) / 100; // Round to 2 decimal places
        
        // Set the form values
        document.getElementById('formName').value = studentName;
        document.getElementById('formAssignmentName').value = this.mainApp.currentActivity.displayName;
        // Use local timezone instead of UTC to avoid timezone confusion
        document.getElementById('formTimeSubmitted').value = new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        });
        document.getElementById('formScore').value = quizScore;
        document.getElementById('formPercentage').value = percentage;
        document.getElementById('formDuration').value = durationMinutes;
        
        // Debug: Log what we're setting
        console.log('Setting form values:');
        console.log('- name:', studentName);
        console.log('- assignmentName:', this.mainApp.currentActivity.displayName);
        console.log('- timeSubmitted:', new Date().toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: true,
            timeZoneName: 'short'
        }));
        console.log('- score:', quizScore);
        console.log('- percentage:', percentage);
        console.log('- duration:', durationMinutes);
        
        // Submit the form
        document.getElementById('googleSheetForm').submit();
        
        // Optional: Show success message
        console.log('Quiz results sent to Google Sheets!');
        console.log('Data sent:', {
            name: studentName,
            assignmentName: this.mainApp.currentActivity.displayName,
            timeSubmitted: new Date().toLocaleString('en-US', {
                year: 'numeric',
                month: '2-digit',
                day: '2-digit',
                hour: '2-digit',
                minute: '2-digit',
                second: '2-digit',
                hour12: true,
                timeZoneName: 'short'
            }),
            score: quizScore,
            percentage: percentage,
            duration: durationMinutes
        });
    }

    // Handle score submission fallback
    handleScoreSubmissionFallback(scoreData) {
        // Store score in localStorage as backup
        const storedScores = JSON.parse(localStorage.getItem('dragDropScores') || '[]');
        storedScores.push({
            ...scoreData,
            storedAt: new Date().toISOString()
        });
        localStorage.setItem('dragDropScores', JSON.stringify(storedScores));
        
        this.mainApp.showFeedback('📋 Score saved locally. Please contact your teacher to submit manually.', 'info');
        console.log('Score stored locally as backup:', scoreData);
    }

    // Show submission status
    showSubmissionStatus({ studentName, timeSubmittedISO, durationFormatted, score, totalLabels }) {
        let note = document.getElementById('submission-status');
        if (!note) {
            note = document.createElement('div');
            note.id = 'submission-status';
            note.className = 'submission-status';
            // place it right below the submit button
            this.mainApp.submitScoreBtn.insertAdjacentElement('afterend', note);
        }
        const submittedAt = new Date(timeSubmittedISO).toLocaleString();
        note.textContent = `${studentName} submitted on ${submittedAt} — Score: ${score}/${totalLabels} correct — Time: ${durationFormatted}`;
    }

    // Reset answer handler state
    reset() {
        this.correctPlacements = 0;
        // Clear any visual feedback from permissive mode
        this.clearVisualFeedback();
        // Update progress display to show reset state
        this.updateProgress();
    }

    // Clear visual feedback (green/red borders from permissive mode)
    clearVisualFeedback() {
        this.mainApp.dropZones.forEach(zone => {
            // Skip zones with no accepted terms (blank zones)
            if (!zone.acceptedTerms || zone.acceptedTerms.length === 0) return;
            
            const zoneElement = document.getElementById(zone.id);
            if (!zoneElement) return;
            
            // Reset zone styling
            zoneElement.style.border = '';
            zoneElement.style.backgroundColor = '';
            
            // Reset individual label styling
            const placedLabels = Array.from(zoneElement.querySelectorAll('.placed-label'));
            placedLabels.forEach(label => {
                label.style.border = '';
                label.style.backgroundColor = '';
            });
        });
    }

    // Set validation mode
    setValidationMode(mode) {
        if (mode === 'strict' || mode === 'permissive') {
            this.validationMode = mode;
            console.log(`Answer validation mode set to: ${mode}`);
            return true;
        } else {
            console.error('Invalid validation mode. Use "strict" or "permissive"');
            return false;
        }
    }

    // Get current validation mode
    getValidationMode() {
        return this.validationMode;
    }

    // Enable permissive mode (incorrect answers accepted without feedback)
    enablePermissiveMode() {
        this.setValidationMode('permissive');
    }

    // Enable strict mode (incorrect answers show error feedback)
    enableStrictMode() {
        this.setValidationMode('strict');
    }

    // Get stored scores
    getStoredScores() {
        const storedScores = JSON.parse(localStorage.getItem('dragDropScores') || '[]');
        return storedScores;
    }

    // Clear stored scores
    clearStoredScores() {
        localStorage.removeItem('dragDropScores');
        this.mainApp.showFeedback('All stored scores cleared.', 'success');
    }

    // Export stored scores
    exportStoredScores() {
        const storedScores = this.getStoredScores();
        if (storedScores.length === 0) {
            this.mainApp.showFeedback('No stored scores found.', 'info');
            return;
        }
        
        const blob = new Blob([JSON.stringify(storedScores, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `stored_scores_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.mainApp.showFeedback(`Exported ${storedScores.length} stored scores.`, 'success');
    }

    // Create score report
    createScoreReport(scoreData) {
        // Create a downloadable score report as JSON
        const reportData = {
            ...scoreData,
            reportGeneratedAt: new Date().toISOString(),
            reportType: 'student_score_report'
        };
        
        const blob = new Blob([JSON.stringify(reportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `score_report_${this.mainApp.studentName}_${this.mainApp.currentActivity.name}_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        console.log('Score report downloaded:', reportData);
    }
}
