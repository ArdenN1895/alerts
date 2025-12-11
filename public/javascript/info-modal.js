// Emergency Guide Modal Logic
        const emergencyGuideBtn = document.getElementById('emergencyGuideBtn');
        const emergencyGuideModal = document.getElementById('emergencyGuideModal');
        const emergencyGuideClose = document.getElementById('emergencyGuideClose');
        const emergencyGuideOverlay = document.querySelector('.emergency-guide-overlay');
        const emergencyTabs = document.querySelectorAll('.emergency-tab');
        const emergencyTabContents = document.querySelectorAll('.emergency-tab-content');

        // Open Modal
        emergencyGuideBtn.addEventListener('click', () => {
            emergencyGuideModal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });

        // Close Modal
        const closeModal = () => {
            emergencyGuideModal.classList.remove('active');
            document.body.style.overflow = '';
        };

        emergencyGuideClose.addEventListener('click', closeModal);
        emergencyGuideOverlay.addEventListener('click', closeModal);

        // Close on ESC key
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && emergencyGuideModal.classList.contains('active')) {
                closeModal();
            }
        });

        // Tab Switching
        emergencyTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.dataset.tab;

                // Remove active class from all tabs and contents
                emergencyTabs.forEach(t => t.classList.remove('active'));
                emergencyTabContents.forEach(c => c.classList.remove('active'));

                // Add active class to clicked tab and corresponding content
                tab.classList.add('active');
                document.getElementById(targetTab).classList.add('active');
            });
        });
