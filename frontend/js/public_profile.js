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
    let currentUser = null; // Store current user info
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
    async function loadPhotoData(photoId) {
        currentPhotoId = photoId;
        commentsList.innerHTML = '<p class="text-xs text-gray-500 text-center">Loading interactions...</p>';
        likeCount.textContent = '...';
        likeBtn.innerHTML = '<i class="far fa-heart"></i>';
        likeBtn.classList.remove('text-red-500');

        // Ensure currentUser is loaded before checks
        if (accessToken && !currentUser) {
            await fetchCurrentUser();
        }

        // ALWAYS fetch data (Public Read)

        try {
            // A. Fetch Likes Status
            // Pass auth headers if available, otherwise just fetch
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
            commentsList.innerHTML = '<p class="text-xs text-red-500">Failed to load data.</p>';
        }

        // C. Update UI based on Login State
        if (!accessToken) {
            // Guest Mode
            commentInput.placeholder = "Login to comment";
            commentInput.disabled = true;
            postCommentBtn.disabled = true;
        } else {
            // User Mode
            commentInput.placeholder = "Add a comment...";
            commentInput.disabled = false;
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
        commentsList.innerHTML = '';
        if (comments.length === 0) {
            commentsList.innerHTML = '<p class="text-xs text-gray-600 text-center py-4">No comments yet. Be the first!</p>';
            return;
        }

        // Determine Context
        const currentUsername = currentUser ? currentUser.username : null;

        // Robust way to get Profile Owner from URL: /u/username/
        // pathname = "/u/piyush/" -> split -> ["", "u", "piyush", ""]
        const pathParts = window.location.pathname.split('/');
        const profileOwnerUsername = pathParts[2];

        console.log("Debug Permissions:", { currentUsername, profileOwnerUsername });

        comments.forEach(comment => {
            const div = document.createElement('div');
            div.className = 'flex gap-3 text-sm group relative'; // Added relative + group

            // Logic: Show Delete if I am the Author OR I am the Profile Owner
            const isAuthor = currentUsername === comment.username;
            const isProfileOwner = currentUsername === profileOwnerUsername;

            // Debug individual checks
            // console.log(`Comment by ${comment.username}: isAuthor=${isAuthor}, isProfileOwner=${isProfileOwner}`);

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

        // Scroll to bottom
        const container = document.getElementById('lightbox-comments-container');
        if (container) container.scrollTop = container.scrollHeight;
    }

    async function handleDeleteComment(e) {
        if (!confirm("Delete this comment?")) return;

        const btn = e.currentTarget;
        const commentId = btn.getAttribute('data-id');
        const commentDiv = btn.closest('.flex'); // The parent container

        try {
            const res = await fetch(`/api/comments/${commentId}/`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (res.ok) {
                commentDiv.remove();
                // If list empty, show placeholder? Optional.
            } else {
                alert("Failed to delete comment");
            }
        } catch (err) {
            console.error("Delete error", err);
        }
    }

    // --- 2. Action Handlers ---

    // Like Toggle
    if (likeBtn) {
        likeBtn.addEventListener('click', async () => {
            if (!accessToken) {
                // Toast logic required here, but importing it is tricky if not exported
                // We'll use a simple alert or just fallback to visual cue
                alert("Please login to like photos!"); // Simple fallback
                return;
            };

            // ... (rest is same)

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
                    const newComment = await res.json();

                    // Remove "No comments" msg if exists
                    if (commentsList.querySelector('p.text-center')) {
                        commentsList.innerHTML = '';
                    }

                    const div = document.createElement('div');
                    div.className = 'flex gap-3 text-sm animate-fade-in';
                    div.innerHTML = `
                        <div class="w-8 h-8 shrink-0 rounded-full bg-gray-700 overflow-hidden border border-white/20">
                             ${newComment.avatar
                            ? `<img src="${newComment.avatar}" class="w-full h-full object-cover">`
                            : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-[8px] font-bold">${newComment.username[0].toUpperCase()}</div>`
                        }
                        </div>
                        <div>
                            <span class="font-bold text-white mr-2">${newComment.username}</span>
                            <span class="text-gray-300">${newComment.text}</span>
                        </div>
                    `;
                    commentsList.appendChild(div);
                    commentInput.value = '';

                    // Scroll to bottom
                    const container = document.getElementById('lightbox-comments-container');
                    if (container) container.scrollTop = container.scrollHeight;

                }
            } catch (err) {
                console.error("Comment failed", err);
            } finally {
                postCommentBtn.textContent = originalBtnText;
                postCommentBtn.disabled = true;
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
                    loadPhotoData(photoId);
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
    }

    if (lightboxClose) lightboxClose.addEventListener('click', closeLightbox);

    lightboxModal.addEventListener('click', (e) => {
        if (e.target === lightboxModal || e.target.classList.contains('flex')) {
            // Check flex container too since image isn't full width anymore
            // Actually relying on bubbling from main card stopPropagation
            closeLightbox();
        }
    });

    // Since the main card has stopPropagation, clicking backdrop works.
    // Logic: The click listener on lightboxModal triggers only if target is the modal overlay itself.
    // The main card has onclick="event.stopPropagation()" in HTML, so clicks inside don't bubble.
    // But the backdrop is the parent, so strictly speaking e.target === lightboxModal is correct.

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !lightboxModal.classList.contains('hidden')) {
            closeLightbox();
        }
    });
}
