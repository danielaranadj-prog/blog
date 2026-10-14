// Loading Skeleton utilities
export function showSkeleton(containerId, type = 'grid', count = 6) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const skeletons = {
        grid: createGridSkeleton(count),
        list: createListSkeleton(count),
        card: createCardSkeleton()
    };

    container.innerHTML = skeletons[type] || skeletons.grid;
}

export function hideSkeleton(containerId) {
    const container = document.getElementById(containerId);
    if (container) {
        container.innerHTML = '';
    }
}

function createGridSkeleton(count) {
    return `
        <div class="grid grid-cols-1 md:grid-cols-3 gap-4 animate-pulse">
            ${Array(count).fill(0).map(() => `
                <div class="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm border border-gray-200 dark:border-slate-700">
                    <div class="h-40 bg-gray-200 dark:bg-slate-700"></div>
                    <div class="p-4 space-y-3">
                        <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                        <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                        <div class="flex gap-2 mt-4">
                            <div class="h-8 bg-gray-200 dark:bg-slate-700 rounded flex-1"></div>
                            <div class="h-8 w-8 bg-gray-200 dark:bg-slate-700 rounded"></div>
                        </div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function createListSkeleton(count) {
    return `
        <div class="space-y-4 animate-pulse">
            ${Array(count).fill(0).map(() => `
                <div class="flex items-center gap-4 bg-white dark:bg-slate-800 p-4 rounded-xl border border-gray-200 dark:border-slate-700">
                    <div class="w-14 h-14 rounded-full bg-gray-200 dark:bg-slate-700"></div>
                    <div class="flex-1 space-y-2">
                        <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-1/3"></div>
                        <div class="h-3 bg-gray-200 dark:bg-slate-700 rounded w-1/4"></div>
                    </div>
                    <div class="flex gap-2">
                        <div class="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded"></div>
                        <div class="w-8 h-8 bg-gray-200 dark:bg-slate-700 rounded"></div>
                    </div>
                </div>
            `).join('')}
        </div>
    `;
}

function createCardSkeleton() {
    return `
        <div class="bg-white dark:bg-slate-800 rounded-xl p-6 shadow-sm border border-gray-200 dark:border-slate-700 animate-pulse">
            <div class="space-y-4">
                <div class="h-6 bg-gray-200 dark:bg-slate-700 rounded w-1/2"></div>
                <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-full"></div>
                <div class="h-4 bg-gray-200 dark:bg-slate-700 rounded w-3/4"></div>
                <div class="h-10 bg-gray-200 dark:bg-slate-700 rounded w-full mt-6"></div>
            </div>
        </div>
    `;
}

// Expose globally
window.showSkeleton = showSkeleton;
window.hideSkeleton = hideSkeleton;
