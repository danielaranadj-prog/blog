import { visit } from 'unist-util-visit';

function getYoutubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : null;
}

function getTiktokId(url) {
    // Matches https://www.tiktok.com/@user/video/1234567890123456789
    const regExp = /^.*tiktok\.com\/@[^/]+\/video\/(\d+).*/;
    const match = url.match(regExp);
    return match ? match[1] : null;
}

export function remarkVideo() {
    return (tree) => {
        visit(tree, 'paragraph', (node) => {
            // Check if paragraph has exactly one child
            if (node.children.length !== 1) return;

            const child = node.children[0];
            let url = null;

            // Handle [Link](url)
            if (child.type === 'link') {
                url = child.url;
            }
            // Handle plain text URL
            else if (child.type === 'text') {
                const text = child.value.trim();
                // Basic URL check
                if (text.startsWith('http')) {
                    url = text;
                }
            }

            if (!url) return;

            const youtubeId = getYoutubeId(url);
            const tiktokId = getTiktokId(url);

            if (youtubeId) {
                node.type = 'html';
                node.children = undefined;
                node.value = `<div class="video-embed-wrapper" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; max-width: 100%; border-radius: 12px; margin-top: 2rem; margin-bottom: 2rem; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
                    <iframe 
                        src="https://www.youtube.com/embed/${youtubeId}" 
                        style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" 
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                        allowfullscreen>
                    </iframe>
                </div>`;
            } else if (tiktokId) {
                // TikTok 'standard' embed code without using undocumented iframes
                node.type = 'html';
                node.children = undefined;
                node.value = `<div class="video-embed-wrapper tiktok-container" style="display: flex; justify-content: center; margin-top: 2rem; margin-bottom: 2rem;">
                    <blockquote class="tiktok-embed" cite="${url}" data-video-id="${tiktokId}" style="max-width: 605px; min-width: 325px;">
                        <section></section>
                    </blockquote>
                    <script async src="https://www.tiktok.com/embed.js"></script>
                </div>`;
            }
        });
    };
}
