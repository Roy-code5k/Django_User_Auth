import { authFetch, showToast } from './utils.js';

// WhatsApp-style emoji set for quick reactions
const QUICK_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];
const ALL_EMOJIS = [
    '😀', '😃', '😄', '😁', '😅', '😂', '🤣', '😊', '😇', '🙂',
    '😉', '😌', '😍', '🥰', '😘', '😗', '😙', '😚', '😋', '😛',
    '😝', '😜', '🤪', '🤨', '🧐', '🤓', '😎', '🥳', '😏', '😒',
    '😞', '😔', '😟', '😕', '🙁', '😣', '😖', '😫', '😩', '🥺',
    '😢', '😭', '😤', '😠', '😡', '🤬', '🤯', '😳', '🥵', '🥶',
    '😱', '😨', '😰', '😥', '😓', '🤗', '🤔', '🤭', '🤫', '🤥',
    '😶', '😐', '😑', '😬', '🙄', '😯', '😦', '😧', '😮', '😲',
    '🥱', '😴', '🤤', '😪', '😵', '🤐', '🥴', '🤢', '🤮', '🤧',
    '👍', '👎', '👏', '🙌', '👐', '🤝', '🙏', '✌️', '🤞', '🤟',
    '🤘', '🤙', '👈', '👉', '👆', '👇', '☝️', '👌', '🤏', '👊',
    '✊', '🤛', '🤜', '🤚', '👋', '🤟', '✋', '🖐', '🖖', '💪',
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '🔥', '⭐',
    '✨', '💫', '💥', '💯', '🎉', '🎊', '🎈', '🎁', '🏆', '🥇'
];

export function initCommunity() {
    if (!window.location.pathname.includes('/community/')) return;

    const messagesContainer = document.getElementById('chat-messages');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const emojiBtn = document.getElementById('chat-emoji-btn');

    const communitySelect = document.getElementById('community-select');
    const communityTitle = document.getElementById('community-title');
    const communityMeta = document.getElementById('community-meta');

    const openCreateBtn = document.getElementById('open-create-community');
    const createModal = document.getElementById('create-community-modal');
    const closeCreateBtn = document.getElementById('close-create-community');
    const createForm = document.getElementById('create-community-form');
    const communityNameInput = document.getElementById('community-name-input');
    const createErr = document.getElementById('create-community-error');

    const membersPanel = document.getElementById('members-panel');
    const membersGlobalHint = document.getElementById('members-global-hint');
    const membersPrivateUI = document.getElementById('members-private-ui');
    const membersCount = document.getElementById('members-count');
    const membersList = document.getElementById('members-list');

    const memberSearchInput = document.getElementById('member-search-input');
    const memberSearchResults = document.getElementById('member-search-results');

    let selectedCommunityId = null; // null => global
    let isHoveringReactionMenu = false; // Track hover state to prevent re-render
    let isAtBottom = true; // Track if user is scrolled to bottom
    let pollTimer = null;
    let searchTimer = null;

    function getChatListUrl() {
        return selectedCommunityId ? `/api/communities/${selectedCommunityId}/chat/` : '/api/chat/';
    }

    function getChatDeleteUrl(messageId) {
        return selectedCommunityId
            ? `/api/communities/${selectedCommunityId}/chat/${messageId}/`
            : `/api/chat/${messageId}/`;
    }

    function setSelectedCommunityFromStorage() {
        const saved = localStorage.getItem('selected_community_id');
        if (!saved || saved === 'global') {
            selectedCommunityId = null;
            return;
        }
        const id = Number(saved);
        selectedCommunityId = Number.isFinite(id) ? id : null;
    }

    function persistSelectedCommunity() {
        localStorage.setItem('selected_community_id', selectedCommunityId ? String(selectedCommunityId) : 'global');
    }

    async function loadCommunities() {
        const res = await authFetch('/api/communities/');
        if (!res.ok) return;
        const communities = await res.json();

        // Rebuild select
        communitySelect.innerHTML = '';
        const globalOpt = document.createElement('option');
        globalOpt.value = 'global';
        globalOpt.textContent = 'Global Chat';
        communitySelect.appendChild(globalOpt);

        communities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = String(c.id);
            opt.textContent = c.name;
            communitySelect.appendChild(opt);
        });

        // Restore selection if possible
        if (selectedCommunityId) {
            const exists = communities.some(c => c.id === selectedCommunityId);
            if (exists) {
                communitySelect.value = String(selectedCommunityId);
            } else {
                selectedCommunityId = null;
                communitySelect.value = 'global';
                persistSelectedCommunity();
            }
        } else {
            communitySelect.value = 'global';
        }

        updateCommunityHeader(communities);
    }

    function updateCommunityHeader(communities) {
        if (!selectedCommunityId) {
            communityTitle.textContent = 'Global Chat';
            communityMeta.textContent = '';
            membersGlobalHint.classList.remove('hidden');
            membersPrivateUI.classList.add('hidden');
            membersCount.textContent = '';
            return;
        }

        const c = (communities || []).find(x => x.id === selectedCommunityId);
        communityTitle.textContent = c ? c.name : `Community #${selectedCommunityId}`;
        communityMeta.textContent = c ? (c.is_admin ? 'Admin' : 'Member') : '';
        membersGlobalHint.classList.add('hidden');
        membersPrivateUI.classList.remove('hidden');
    }

    async function loadMembers() {
        if (!selectedCommunityId) {
            membersList.innerHTML = '';
            memberSearchResults.classList.add('hidden');
            return;
        }

        const res = await authFetch(`/api/communities/${selectedCommunityId}/members/`);
        if (!res.ok) {
            membersList.innerHTML = '<div class="text-sm text-gray-400">Unable to load members.</div>';
            return;
        }

        const members = await res.json();
        membersCount.textContent = `${members.length}`;

        membersList.innerHTML = members.map(m => {
            const avatar = m.avatar
                ? `<img src="${m.avatar}" class="w-full h-full object-cover" />`
                : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">${m.username[0].toUpperCase()}</div>`;

            const badge = m.role === 'admin'
                ? '<span class="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/20 text-cyan-300 border border-cyan-500/20">admin</span>'
                : '';

            return `
                <div class="flex items-center gap-3 px-3 py-2 rounded-xl bg-white/5 border border-white/10">
                    <div class="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">${avatar}</div>
                    <div class="min-w-0 flex-1">
                        <div class="text-sm font-bold truncate">${m.display_name || m.username}</div>
                        <div class="text-xs text-gray-500 truncate">@${m.username}</div>
                    </div>
                    ${badge}
                </div>
            `;
        }).join('');
    }

    async function loadMessages() {
        const res = await authFetch(getChatListUrl());
        if (!res.ok) {
            if (res.status === 403) {
                messagesContainer.innerHTML = '<div class="text-center mt-10"><p class="text-gray-400">You are not a member of this community.</p></div>';
                return;
            }
            return;
        }
        const messages = await res.json();
        renderMessages(messages);
    }

    // =============================================
    // MESSAGE REACTIONS
    // =============================================
    async function addReaction(messageId, emoji) {
        const url = selectedCommunityId
            ? `/api/communities/${selectedCommunityId}/chat/${messageId}/react/`
            : `/api/chat/${messageId}/react/`;

        const res = await authFetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji })
        });

        if (res.ok) {
            await loadMessages();
        }
    }

    async function removeReaction(messageId, emoji) {
        const url = selectedCommunityId
            ? `/api/communities/${selectedCommunityId}/chat/${messageId}/react/`
            : `/api/chat/${messageId}/react/`;

        const res = await authFetch(url, {
            method: 'DELETE',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ emoji })
        });

        if (res.ok) {
            await loadMessages();
        }
    }

    // Show emoji picker popup
    function showEmojiPicker() {
        // Remove existing picker
        document.getElementById('emoji-picker')?.remove();

        const picker = document.createElement('div');
        picker.id = 'emoji-picker';
        picker.className = 'fixed bottom-24 left-6 z-50 glass-card rounded-2xl p-4 border border-white/10 shadow-2xl w-80 max-h-96 overflow-y-auto custom-scrollbar';
        picker.innerHTML = `
            <div class="grid grid-cols-8 gap-2">
                ${ALL_EMOJIS.map(emoji => `
                    <button class="emoji-btn text-2xl hover:scale-125 transition p-1" data-emoji="${emoji}">${emoji}</button>
                `).join('')}
            </div>
        `;

        document.body.appendChild(picker);

        // Add click handlers for emoji selection
        picker.querySelectorAll('.emoji-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                const emoji = btn.getAttribute('data-emoji');
                chatInput.value += emoji;
                chatInput.focus();
                picker.remove();
            });
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closePicker(e) {
                if (!picker.contains(e.target) && e.target !== emojiBtn) {
                    picker.remove();
                    document.removeEventListener('click', closePicker);
                }
            });
        }, 100);
    }

    function renderMessages(messages) {
        // Don't re-render if user is hovering over reaction menu
        if (isHoveringReactionMenu) {
            return;
        }

        messagesContainer.innerHTML = '';

        if (!messages || messages.length === 0) {
            messagesContainer.innerHTML = '<div class="text-center text-gray-500 py-20"><p>No messages yet. Say hi!</p></div>';
            return;
        }

        messages.forEach((msg, index) => {
            const isMe = msg.is_me;
            const prevMsg = messages[index - 1];
            const nextMsg = messages[index + 1];

            // Check if this message should be grouped with previous
            const isGrouped = prevMsg &&
                prevMsg.username === msg.username &&
                (new Date(msg.created_at) - new Date(prevMsg.created_at)) < 60000; // within 1 min

            // Check if next message will be grouped (to determine if we should show timestamp)
            const nextIsGrouped = nextMsg &&
                nextMsg.username === msg.username &&
                (new Date(nextMsg.created_at) - new Date(msg.created_at)) < 60000;

            const div = document.createElement('div');
            div.className = `flex gap-3 ${isGrouped ? 'mb-1' : 'mb-4'} ${isMe ? 'flex-row-reverse' : 'flex-row'} group`;

            // Avatar - only show if not grouped or if last in file
            const showAvatar = !isGrouped;
            const avatarHtml = showAvatar ? `
                <div class="w-8 h-8 rounded-full bg-gray-700 overflow-hidden border border-white/20 shrink-0 mt-1">
                    ${msg.avatar
                    ? `<img src="${msg.avatar}" class="w-full h-full object-cover">`
                    : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">${msg.username[0].toUpperCase()}</div>`
                }
                </div>
            ` : '<div class="w-8 h-8 shrink-0"></div>'; // Placeholder for alignment

            const bubbleClass = isMe
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-l-2xl rounded-tr-2xl'
                : 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-r-2xl rounded-tl-2xl';

            const deleteBtn = isMe
                ? `<button class="delete-msg-btn text-xs text-red-400 hover:text-red-300 ml-2 opacity-50 hover:opacity-100 transition" data-id="${msg.id}"><i class="fas fa-trash"></i></button>`
                : '';

            // Quick reactions menu (WhatsApp style)
            const quickReactions = `
                <div class="quick-reaction-menu absolute -top-8 ${isMe ? 'right-0' : 'left-0'} bg-gray-800/95 backdrop-blur-md rounded-full px-2 py-1 hidden group-hover:flex items-center gap-1 shadow-lg border border-white/10 z-10">
                    ${QUICK_EMOJIS.map(emoji => `
                        <button class="quick-react-btn text-lg hover:scale-125 transition" data-msg-id="${msg.id}" data-emoji="${emoji}">${emoji}</button>
                    `).join('')}
                </div>
            `;

            // Render existing reactions
            const reactionsHtml = msg.reactions && msg.reactions.length > 0 ? `
                <div class="flex flex-wrap gap-1 mt-1">
                    ${msg.reactions.map(r => {
                const hasUserReacted = r.users.some(u => u.is_me);
                return `
                            <button class="reaction-bubble px-2 py-0.5 rounded-full text-xs flex items-center gap-1 transition
                                ${hasUserReacted ? 'bg-cyan-500/30 border border-cyan-400/50' : 'bg-white/10 border border-white/20'}
                                hover:scale-105" 
                                data-msg-id="${msg.id}" data-emoji="${r.emoji}">
                                <span>${r.emoji}</span>
                                <span class="font-bold">${r.count}</span>
                            </button>
                        `;
            }).join('')}
                </div>
            ` : '';

            div.innerHTML = `
                ${avatarHtml}
                <div class="flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'} relative">
                    ${quickReactions}
                    ${!isGrouped ? `
                        <div class="flex items-center gap-2 mb-1 px-1">
                            <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">${msg.username}</span>
                            ${deleteBtn}
                        </div>
                    ` : ''}
                    <div class="${bubbleClass} px-4 py-2 shadow-sm break-words text-sm leading-relaxed">${msg.text}</div>
                    ${!nextIsGrouped ? `<span class="text-[9px] text-gray-500 mt-1 px-1">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` : ''}
                    ${reactionsHtml}
                </div>
            `;

            messagesContainer.appendChild(div);
        });

        // Track hover state on reaction menus
        messagesContainer.querySelectorAll('.quick-reaction-menu').forEach(menu => {
            menu.addEventListener('mouseenter', () => {
                isHoveringReactionMenu = true;
            });
            menu.addEventListener('mouseleave', () => {
                isHoveringReactionMenu = false;
            });
        });

        // Add event listeners for quick reactions
        messagesContainer.querySelectorAll('.quick-react-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const msgId = btn.getAttribute('data-msg-id');
                const emoji = btn.getAttribute('data-emoji');
                await addReaction(msgId, emoji);
            });
        });

        // Add event listeners for reaction bubbles (click to toggle)
        messagesContainer.querySelectorAll('.reaction-bubble').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const msgId = btn.getAttribute('data-msg-id');
                const emoji = btn.getAttribute('data-emoji');
                const reaction = messages.find(m => m.id == msgId)?.reactions.find(r => r.emoji === emoji);
                const hasUserReacted = reaction?.users.some(u => u.is_me);

                if (hasUserReacted) {
                    await removeReaction(msgId, emoji);
                } else {
                    await addReaction(msgId, emoji);
                }
            });
        });

        document.querySelectorAll('.delete-msg-btn').forEach(btn => {
            btn.addEventListener('click', deleteMessage);
        });

        // Only auto-scroll if user was already at bottom
        if (isAtBottom) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    }

    async function deleteMessage(e) {
        if (!confirm('Delete this message?')) return;
        const id = e.currentTarget.getAttribute('data-id');
        const res = await authFetch(getChatDeleteUrl(id), { method: 'DELETE' });
        if (res.ok) {
            loadMessages();
        }
    }

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const text = chatInput.value.trim();
        if (!text) return;

        chatInput.value = '';

        const res = await authFetch(getChatListUrl(), {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (res.ok) {
            loadMessages();
        } else if (res.status === 403) {
            showToast('You are not allowed to post in this community.', 'error');
        }
    });

    // Emoji picker button
    emojiBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        showEmojiPicker();
    });

    communitySelect.addEventListener('change', async (e) => {
        const val = e.target.value;
        selectedCommunityId = val === 'global' ? null : Number(val);
        persistSelectedCommunity();
        await loadCommunities();
        await loadMembers();
        await loadMessages();
    });

    openCreateBtn.addEventListener('click', () => {
        createErr.textContent = '';
        communityNameInput.value = '';
        createModal.classList.remove('hidden');
        communityNameInput.focus();
    });

    closeCreateBtn.addEventListener('click', () => {
        createModal.classList.add('hidden');
    });

    createForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        createErr.textContent = '';

        const name = communityNameInput.value.trim();
        if (!name) return;

        const res = await authFetch('/api/communities/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name }),
        });

        if (res.ok) {
            const c = await res.json();
            createModal.classList.add('hidden');
            selectedCommunityId = c.id;
            persistSelectedCommunity();
            await loadCommunities();
            await loadMembers();
            await loadMessages();
            showToast('Community created', 'success');
        } else {
            const data = await res.json().catch(() => ({}));
            createErr.textContent = data.detail || 'Failed to create community';
        }
    });

    async function performUserSearch(query) {
        if (!selectedCommunityId) return;
        if (!query || query.trim().length < 2) {
            memberSearchResults.classList.add('hidden');
            memberSearchResults.innerHTML = '';
            return;
        }

        const res = await authFetch(`/api/search/users/?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) {
            memberSearchResults.classList.add('hidden');
            return;
        }

        const users = await res.json();
        if (!users.length) {
            memberSearchResults.innerHTML = '<div class="px-4 py-4 text-sm text-gray-400">No users found</div>';
            memberSearchResults.classList.remove('hidden');
            return;
        }

        memberSearchResults.innerHTML = users.map(u => {
            const avatar = u.avatar
                ? `<img src="${u.avatar}" class="w-full h-full object-cover" />`
                : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">${u.username[0].toUpperCase()}</div>`;

            return `
                <div class="flex items-center gap-3 px-4 py-3 hover:bg-white/5 transition">
                    <div class="w-8 h-8 rounded-full overflow-hidden border border-white/10 shrink-0">${avatar}</div>
                    <div class="flex-1 min-w-0">
                        <div class="text-sm font-bold truncate">${u.display_name}</div>
                        <div class="text-xs text-gray-500 truncate">@${u.username}</div>
                    </div>
                    <button class="btn-secondary text-xs add-member-btn" data-username="${u.username}">Add</button>
                </div>
            `;
        }).join('');

        memberSearchResults.classList.remove('hidden');

        memberSearchResults.querySelectorAll('.add-member-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const username = e.currentTarget.getAttribute('data-username');
                await addMember(username);
            });
        });
    }

    async function addMember(username) {
        if (!selectedCommunityId) return;
        const res = await authFetch(`/api/communities/${selectedCommunityId}/members/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (res.ok) {
            showToast(`Added @${username}`, 'success');
            memberSearchInput.value = '';
            memberSearchResults.classList.add('hidden');
            await loadMembers();
        } else {
            const data = await res.json().catch(() => ({}));
            showToast(data.detail || 'Failed to add member (are you an admin?)', 'error');
        }
    }

    memberSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const q = e.target.value;
        searchTimer = setTimeout(() => performUserSearch(q), 250);
    });

    document.addEventListener('click', (e) => {
        if (!memberSearchResults.contains(e.target) && !memberSearchInput.contains(e.target)) {
            memberSearchResults.classList.add('hidden');
        }
    });

    // Track scroll position for smart auto-scroll
    messagesContainer.addEventListener('scroll', () => {
        const threshold = 100; // pixels from bottom
        const scrollBottom = messagesContainer.scrollHeight - messagesContainer.scrollTop - messagesContainer.clientHeight;
        isAtBottom = scrollBottom < threshold;
    });

    async function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(loadMessages, 3000);
    }

    (async () => {
        // Hard gate: require login for all chat features.
        if (!localStorage.getItem('access')) {
            messagesContainer.innerHTML = '<div class="text-center mt-10"><p class="text-gray-400 mb-4">Please login to join the chat.</p><a href="/" class="btn-primary">Login</a></div>';
            return;
        }

        setSelectedCommunityFromStorage();
        await loadCommunities();
        await loadMembers();
        await loadMessages();
        await startPolling();
    })();
}
