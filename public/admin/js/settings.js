/**
 * Settings Manager & Kill Switch Logic
 * v: 20260201
 */

// Initialize listener for maintenance mode
// We expose this to be called when Auth is ready
window.initMaintenanceControls = async () => {
    console.log("Initializing Maintenance Controls...");
    await checkMaintenanceStatus();
};

async function checkMaintenanceStatus() {
    try {
        if (!window.firestoreDB || !window.firestoreDoc || !window.firestoreGetDoc) {
            console.warn("Firestore not ready yet, retrying in 500ms...");
            setTimeout(checkMaintenanceStatus, 500);
            return;
        }

        const docRef = window.firestoreDoc(window.firestoreDB, 'settings', 'general');
        const docSnap = await window.firestoreGetDoc(docRef);

        if (docSnap.exists()) {
            const data = docSnap.data();
            const maintenance = data.maintenance_mode || { argentina: false, mexico: false };

            updateToggle('argentina', maintenance.argentina);
            updateToggle('mexico', maintenance.mexico);
        } else {
            // Create default if not exists
            console.log("Settings doc not found, creating default...");
            await window.firestoreSetDoc(docRef, {
                maintenance_mode: { argentina: false, mexico: false },
                maintenance_message: "Estamos mejorando la experiencia. Volvemos pronto."
            }, { merge: true });

            updateToggle('argentina', false);
            updateToggle('mexico', false);
        }

    } catch (e) {
        console.error("Error initializing maintenance controls", e);
        if (window.showToast) window.showToast("Error cargando estado de mantenimiento", "error");
    }
}

function updateToggle(country, isActive) {
    const toggle = document.getElementById(`toggle-maintenance-${country}`);
    if (toggle) {
        toggle.checked = !isActive; // "Active" means maintenance is OFF (Site is Active)
        // Wait, kill switch logic:
        // Toggle Checked = Site Active (Maintenance OFF)
        // Toggle Unchecked = Site Inactive (Maintenance ON)
        // OR
        // Toggle usually implies "Feature ON".
        // Let's look at the label in HTML: "Estado del Sitio" -> "Activo"
        // So:
        // Checked = Activo (Maintenance FALSE)
        // Unchecked = Inactivo/Mantenimiento (Maintenance TRUE)

        toggle.checked = !isActive; // if maintenance is false (active), check it.

        updateStatusText(country, !isActive);
    }
}

function updateStatusText(country, isSiteActive) {
    const container = document.getElementById(`toggle-maintenance-${country}`).parentElement;
    const statusText = container.querySelector('.status-text');
    if (statusText) {
        statusText.textContent = isSiteActive ? 'Activo' : 'En Mantenimiento';
        statusText.className = `ml-2 text-[10px] font-medium status-text ${isSiteActive ? 'text-green-500' : 'text-red-500'}`;
    }
}

// Global function called by HTML onclick/onchange
window.toggleMaintenanceMode = async (country, isChecked) => {
    // isChecked = true -> User wants site ACTIVE -> Maintenance FALSE
    // isChecked = false -> User wants site INACTIVE -> Maintenance TRUE

    const maintenanceMode = !isChecked;

    try {
        const docRef = window.firestoreDoc(window.firestoreDB, 'settings', 'general');

        // Optimistic update
        updateStatusText(country, isChecked);

        // We need to merge with existing data to not overwrite other country
        // But Firestore setDoc with {merge: true} works for top level fields. 
        // For nested fields like maintenance_mode.argentina, we need dot notation if we want to update just one.
        // However, standard setDoc merge replaces the object if we provide the full object.
        // Best practice: Read first or use updateDoc (which references 'update' from firestore, but we only have setDoc exposed globally?)
        // admin/index.html exposes: setDoc. It does NOT expose updateDoc.
        // setDoc with merge: true will merge fields.

        // To handle nested update properly without reading, we need 'updateDoc' or dot notation keys which work in updateDoc.
        // setDoc with { maintenance_mode: { argentina: ... } } and merge:true might overwrite the whole maintenance_mode map if not careful?
        // Actually setDoc merge performs a deep merge on maps.

        // Let's verify what we have.
        // If we only send { maintenance_mode: { [country]: val } } with merge: true, 
        // Firestore determines "maintenance_mode" is a Map. It merges keys.
        // So { maintenance_mode: { argentina: true } } merged into existing { maintenance_mode: { mexico: false } }
        // result: { maintenance_mode: { argentina: true, mexico: false } }.
        // This is safe.

        const updateData = {
            maintenance_mode: {
                [country]: maintenanceMode
            }
        };

        await window.firestoreSetDoc(docRef, updateData, { merge: true });

        if (window.showToast) {
            const msg = isChecked ? `Sitio ${country} ACTIVADO` : `Sitio ${country} puesto en MANTENIMIENTO`;
            window.showToast(msg, isChecked ? 'success' : 'error'); // error style for red color (maintenance)
        }

    } catch (e) {
        console.error("Error setting maintenance mode", e);
        if (window.showToast) window.showToast("Error al guardar estado", "error");
        // Revert toggle
        updateToggle(country, !maintenanceMode); // Current state was maintenanceMode (target), so revert to !target
    }
};
