// GitHub API Service
export class GitHubService {
    constructor() {
        this.config = null;
    }

    setConfig(config) {
        this.config = config;
    }

    async fetch(endpoint, method = 'GET', body = null) {
        if (!this.config) {
            throw new Error('GitHub config not initialized. Please login first.');
        }

        const opts = {
            method,
            headers: {
                'Authorization': `token ${this.config.githubToken}`,
                'Content-Type': 'application/json'
            }
        };

        if (body) {
            opts.body = JSON.stringify(body);
        }

        const url = `https://api.github.com/repos/${this.config.repoOwner}/${this.config.repoName}${endpoint}`;
        const res = await fetch(url, opts);

        if (!res.ok) {
            throw new Error(`GitHub API error: ${res.status} ${res.statusText}`);
        }

        return res.json();
    }

    async getFile(path) {
        return this.fetch(`/contents/${path}`);
    }

    async getFiles(path) {
        return this.fetch(`/contents/${path}`);
    }

    async updateFile(path, content, message, sha) {
        return this.fetch(`/contents/${path}`, 'PUT', {
            message,
            content: btoa(unescape(encodeURIComponent(content))),
            sha
        });
    }

    async createFile(path, content, message) {
        return this.fetch(`/contents/${path}`, 'PUT', {
            message,
            content: btoa(unescape(encodeURIComponent(content)))
        });
    }

    async deleteFile(path, message, sha) {
        return this.fetch(`/contents/${path}`, 'DELETE', {
            message,
            sha
        });
    }

    // Helper to decode file content
    decodeContent(base64Content) {
        return decodeURIComponent(escape(atob(base64Content)));
    }

    // Helper to encode file content
    encodeContent(content) {
        return btoa(unescape(encodeURIComponent(content)));
    }
}

// Create singleton instance
export const github = new GitHubService();

// Expose globally for legacy code
window.ghFetch = (endpoint, method, body) => github.fetch(endpoint, method, body);
