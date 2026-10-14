// Blog Posts Management Module
import { github } from '../services/github.js';
import { showToast } from '../ui/toast.js';

export class BlogManager {
    constructor() {
        this.cachedPosts = [];
        this.setupEventListeners();
    }

    setupEventListeners() {
        // Search functionality
        const searchInput = document.getElementById('search-posts');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filterPosts(e.target.value);
            });
        }
    }

    async loadPosts() {
        const grid = document.getElementById('posts-grid');
        const noResults = document.getElementById('no-results');

        // Show skeleton instead of spinner
        if (grid) {
            window.showSkeleton('posts-grid', 'grid', 6);
        }
        if (noResults) noResults.classList.add('hidden');

        try {
            const config = window.githubConfig;
            if (!config) {
                throw new Error('GitHub config not loaded');
            }

            const files = await github.getFiles(config.postsPath);
            const mdFiles = files.filter(f => f.name.endsWith('.md'));

            const promises = mdFiles.map(async (file) => {
                const data = await github.getFile(file.path);
                const content = github.decodeContent(data.content);

                // Extract frontmatter
                const get = (key) => {
                    const match = content.match(new RegExp(`${key}:\\s*[\"'](.+?)[\"']`));
                    return match ? match[1] : 'Unknown';
                };

                return {
                    name: file.name,
                    path: file.path,
                    sha: file.sha,
                    title: get('title'),
                    image: get('heroImage'),
                    date: get('publishDate'),
                    author: get('author')
                };
            });

            this.cachedPosts = await Promise.all(promises);
            this.cachedPosts.sort((a, b) => new Date(b.date) - new Date(a.date));

            this.updatePostsCount(this.cachedPosts.length);
            this.renderGrid(this.cachedPosts);

        } catch (error) {
            console.error('Error loading posts:', error);
            showToast("Error cargando posts", "error");
            if (grid) grid.innerHTML = '';
        }
    }

    updatePostsCount(count) {
        // Update dashboard badge
        const dashCount = document.getElementById('posts-count');
        if (dashCount) dashCount.textContent = count;

        // Update stats in view-posts
        const statsCount = document.getElementById('stats-total-posts');
        if (statsCount) statsCount.textContent = count;
    }

    renderGrid(posts) {
        const grid = document.getElementById('posts-grid');
        const noResults = document.getElementById('no-results');
        const config = window.githubConfig;

        if (!grid) return;

        if (posts.length === 0) {
            if (noResults) noResults.classList.remove('hidden');
            return;
        } else {
            if (noResults) noResults.classList.add('hidden');
        }

        grid.innerHTML = posts.map(p => `
            <div class="bg-white dark:bg-slate-800 rounded-xl overflow-hidden shadow-sm hover:shadow-xl transition-all border border-gray-200 dark:border-slate-700 flex flex-col h-full group">
                <div class="h-40 overflow-hidden relative bg-gray-200">
                    ${p.image && p.image !== 'Unknown'
                ? `<img src="${p.image}" class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" alt="${p.title}">`
                : '<div class="flex items-center justify-center h-full text-gray-400"><ion-icon name="image-outline" class="text-4xl"></ion-icon></div>'
            }
                    <div class="absolute top-2 right-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded backdrop-blur-md">${p.date}</div>
                </div>
                <div class="p-4 flex-1 flex flex-col">
                    <h3 class="font-bold text-gray-800 dark:text-white mb-2 leading-tight line-clamp-2 text-sm">${p.title}</h3>
                    <p class="text-[10px] text-gray-500 mb-4 flex items-center gap-1">
                        <ion-icon name="person-outline"></ion-icon> ${p.author}
                    </p>
                    <div class="mt-auto flex gap-2">
                        <a href="https://github.com/${config.repoOwner}/${config.repoName}/blob/${config.branch}/${p.path}" 
                           target="_blank" 
                           class="flex-1 text-center py-2 bg-gray-100 dark:bg-slate-700 rounded text-xs font-bold hover:bg-gray-200 dark:hover:bg-slate-600">
                            Ver Código
                        </a>
                        <button onclick="blogManager.deletePost('${p.path}', '${p.sha}')" 
                                class="px-3 py-2 bg-red-50 text-red-500 rounded hover:bg-red-500 hover:text-white transition-colors">
                            <ion-icon name="trash-outline"></ion-icon>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
    }

    filterPosts(query) {
        if (!query) {
            this.renderGrid(this.cachedPosts);
            return;
        }

        const lowercaseQuery = query.toLowerCase();
        const filtered = this.cachedPosts.filter(p =>
            p.title.toLowerCase().includes(lowercaseQuery) ||
            p.author.toLowerCase().includes(lowercaseQuery)
        );

        this.renderGrid(filtered);
    }

    async deletePost(path, sha) {
        // Use custom confirm dialog
        const confirmed = await window.confirm(`¿Eliminar permanentemente este post?\n\n${path}`);
        if (!confirmed) return;

        // Find the delete button that was clicked
        const deleteButtons = document.querySelectorAll(`button[onclick*="${path}"]`);
        const button = Array.from(deleteButtons).find(btn => btn.onclick?.toString().includes('deletePost'));

        try {
            // Show loading state
            if (button) {
                window.setButtonLoading(button, 'Eliminando...');
            }

            const config = window.githubConfig;
            await github.deleteFile(path, `[ADMIN] Delete ${path}`, sha);

            // Show success state
            if (button) {
                window.setButtonSuccess(button, 'Eliminado');
            }

            showToast("Post eliminado", "success");

            // Reload posts after a short delay
            setTimeout(() => this.loadPosts(), 500);

        } catch (error) {
            console.error('Error deleting post:', error);

            // Show error state
            if (button) {
                window.setButtonError(button, 'Error');
            }

            showToast("Error: " + error.message, "error");
        }
    }
}

// Create singleton instance
export const blogManager = new BlogManager();

// Expose globally for onclick handlers and legacy code
window.loadPosts = () => blogManager.loadPosts();
window.filterPosts = (q) => blogManager.filterPosts(q);
window.blogManager = blogManager;
