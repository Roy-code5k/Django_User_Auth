export function initPublicProfile() {
    if (!window.location.pathname.includes('/u/')) return;

    console.log("Initializing Public Profile Lightbox...");

    const galleryItems = document.querySelectorAll('.gallery-item');
    const lightboxModal = document.getElementById('lightbox-modal');
    const lightboxImg = document.getElementById('lightbox-img');
    const lightboxCaption = document.getElementById('lightbox-caption');
    const lightboxClose = document.getElementById('lightbox-close');

    // UI Elements for Likes/Comments
    const likeBtn = document.getElementById('like-btn');
    const likeCount = document.getElementById('like-count');
    const commentsList = document.getElementById('comments-list');
    const commentForm = document.getElementById('comment-form');
    const commentInput = document.getElementById('comment-input');
    const postCommentBtn = document.getElementById('post-comment-btn');

    let currentPhotoId = null;
    let currentUser = null;
    let pollingInterval = null; // Store polling interval
    const accessToken = localStorage.getItem('access');

    if (!lightboxModal) return;

    // Helper: Auth Header
    function getAuthHeaders() {
        return {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
        };
    }

    // --- Fetch Current User ---
    async function fetchCurrentUser() {
        if (!accessToken) return null; // Add return value
        try {
            const res = await fetch('/api/me/', { headers: getAuthHeaders() });
            if (res.ok) {
                currentUser = await res.json();
                return currentUser;
            }
        } catch (err) {
            console.error("Failed to fetch user:", err);
        }
        return null;
    }
    // Initial fetch (fire and forget)
    fetchCurrentUser();

    // --- 1. Load Data (Likes & Comments) ---
    async function loadPhotoData(photoId, isPolling = false) {
        if (!isPolling) {
            // First load: Show loading state
            currentPhotoId = photoId;
            commentsList.innerHTML = '<p class="text-xs text-gray-500 text-center">Loading interactions...</p>';
            likeCount.textContent = '...';
            likeBtn.innerHTML = '<i class="far fa-heart"></i>';
            likeBtn.classList.remove('text-red-500');

            // Ensure currentUser is loaded before checks
            if (accessToken && !currentUser) {
                await fetchCurrentUser();
            }
        }

        try {
            // A. Fetch Likes Status
            const likeHeaders = accessToken ? getAuthHeaders() : { 'Content-Type': 'application/json' };
            const likeRes = await fetch(`/api/photos/${photoId}/like/`, { headers: likeHeaders });

            if (likeRes.ok) {
                const likeData = await likeRes.json();
                updateLikeUI(likeData.is_liked, likeData.like_count);
            }

            // B. Fetch Comments
            const commentsRes = await fetch(`/api/photos/${photoId}/comments/`, { headers: likeHeaders });
            if (commentsRes.ok) {
                const comments = await commentsRes.json();
                renderComments(comments);
            }
        } catch (err) {
            console.error("Error loading photo data:", err);
            if (!isPolling) commentsList.innerHTML = '<p class="text-xs text-red-500">Failed to load data.</p>';
        }

        // C. Update UI based on Login State (Only needed on first load)
        if (!isPolling) {
            if (!accessToken) {
                commentInput.placeholder = "Login to comment";
                commentInput.disabled = true;
                postCommentBtn.disabled = true;
            } else {
                commentInput.placeholder = "Add a comment...";
                commentInput.disabled = false;
            }
        }
    }

    function updateLikeUI(isLiked, count) {
        likeCount.textContent = `${count} likes`;
        if (isLiked) {
            likeBtn.innerHTML = '<i class="fas fa-heart"></i>'; // Solid
            likeBtn.classList.add('text-red-500');
        } else {
            likeBtn.innerHTML = '<i class="far fa-heart"></i>'; // Outline
            likeBtn.classList.remove('text-red-500');
        }
    }

    function renderComments(comments) {
        // If we are polling, we might want to avoid completely wiping content if specific edits differ
        // But for "flawless" simplicity: simple re-render is okay if it doesn't break scroll.
        // We will preserve scroll position.
        const container = document.getElementById('lightbox-comments-container');
        const scrollPos = container ? container.scrollTop : 0;
        const wasAtBottom = container ? (container.scrollHeight - container.scrollTop === container.clientHeight) : false;

        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="text-xs text-gray-600 text-center py-4">No comments yet. Be the first!</p>';
            return; // Scroll pos irrelevant here
        }

        // Determine Context
        const currentUsername = currentUser ? currentUser.username : null;

        // Robust way to get Profile Owner from URL: /u/username/
        const pathParts = window.location.pathname.split('/');
        const profileOwnerUsername = pathParts[2];

        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'flex gap-3 text-sm group relative';

            const isAuthor = currentUsername === comment.username;
            const isProfileOwner = currentUsername === profileOwnerUsername;
            const isOwner = currentUsername && (isAuthor || isProfileOwner);

            const deleteBtn = isOwner
                ? `<button class="delete-comment-btn absolute right-0 top-0 text-gray-500 hover:text-red-500 opacity-0 group-hover:opacity-100 transition px-2" data-id="${comment.id}"><i class="fas fa-trash"></i></button>`
                : '';

            div.innerHTML = `
                <div class="w-8 h-8 shrink-0 rounded-full bg-gray-700 overflow-hidden border border-white/20">
                     ${comment.avatar
                    ? `<img src="${comment.avatar}" class="w-full h-full object-cover">`
                    : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-[8px] font-bold">${comment.username[0].toUpperCase()}</div>`
                }
                </div>
                <div class="flex-1">
                    <span class="font-bold text-white mr-2">${comment.username}</span>
                    <span class="text-gray-300 break-words">${comment.text}</span>
                </div>
                ${deleteBtn}
            `;
            commentsList.appendChild(div);
        });

        // Add Delete Listeners
        document.querySelectorAll('.delete-comment-btn').forEach(btn => {
            btn.addEventListener('click', handleDeleteComment);
        });

        // Restore scroll or snap to bottom if it was at bottom
        if (container) {
            if (wasAtBottom) {
                container.scrollTop = container.scrollHeight;
            } else {
                container.scrollTop = scrollPos;
            }
        }
    }

    // --- 2. Action Handlers ---

    // Like Toggle
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!accessToken) {
                alert("Please login to like photos!");
                return;
            };

            // Optimistic UI
            const isLiked = likeBtn.classList.contains('text-red-500');
            let count = parseInt(likeCount.textContent) || 0;
            updateLikeUI(!isLiked, isLiked ? count - 1 : count + 1);

            try {
                const res = await fetch(`/api/photos/${currentPhotoId}/like/`, {
                    method: 'POST',
                    headers: getAuthHeaders()
                });
                if (!res.ok) throw new Error();
                const data = await res.json();
                updateLikeUI(data.is_liked, data.like_count);
            } catch (err) {
                console.error("Like failed", err);
                // Revert
                updateLikeUI(isLiked, count);
            }
        });
    }

    // Post Comment
    if (commentInput) {
        commentInput.addEventListener('input', (e) => {
            postCommentBtn.disabled = e.target.value.trim().length === 0;
        });
    }

    if (commentForm) {
        commentForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const text = commentInput.value.trim();
            if (!text || !currentPhotoId || !accessToken) return;

            // Show loading state
            const originalBtnText = postCommentBtn.textContent;
            postCommentBtn.textContent = '...';
            postCommentBtn.disabled = true;

            try {
                const res = await fetch(`/api/photos/${currentPhotoId}/comments/`, {
                    method: 'POST',
                    headers: getAuthHeaders(),
                    body: JSON.stringify({ text })
                });

                if (res.ok) {
                    commentInput.value = '';
                    loadPhotoData(currentPhotoId, true); // Refresh immediately

                    // Scroll to bottom
                    const container = document.getElementById('lightbox-comments-container');
                    if (container) container.scrollTop = container.scrollHeight;
                }
            } catch (err) {
                console.error("Comment failed", err);
            } finally {
                postCommentBtn.textContent = originalBtnText;
                postCommentBtn.disabled = true; // Remains disabled as input is empty
            }
        });
    }


    // --- 3. Lightbox Open Logic ---
    galleryItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const imgSrc = item.getAttribute('src');
            const caption = item.getAttribute('data-caption');
            const photoId = item.getAttribute('data-photo-id');

            if (imgSrc) {
                lightboxImg.src = imgSrc;
                if (lightboxCaption) lightboxCaption.textContent = caption || '';

                lightboxModal.classList.remove('hidden');
                document.body.style.overflow = 'hidden';

                if (photoId) {
                    loadPhotoData(photoId, false); // Initial Load

                    // Start Polling
                    if (pollingInterval) clearInterval(pollingInterval);
                    pollingInterval = setInterval(() => {
                        // Check if still open
                        if (currentPhotoId && !document.getElementById('lightbox-modal').classList.contains('hidden')) {
                            loadPhotoData(currentPhotoId, true);
                        }
                    }, 3000);
                }
            }
        });
    });

    // Close Interaction
    function closeLightbox() {
        lightboxModal.classList.add('hidden');
        lightboxImg.src = '';
        currentPhotoId = null;
        document.body.style.overflow = '';
        if (pollingInterval) {
            clearInterval(pollingInterval);
            pollingInterval = null;
        }
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal || e.target.classList.contains('flex')) {
            closeLightbox();
        }
    });

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
            closeLightbox();
        }
    });
}
