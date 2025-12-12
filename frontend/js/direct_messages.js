import { authFetch, showToast } from './utils.js';

export function initDirectMessages() {
    if (!window.location.pathname.includes('/messages/')) return;

    const threadsEl = document.getElementById('dm-threads');
    const messagesEl = document.getElementById('dm-messages');
    const titleEl = document.getElementById('dm-title');
    const profileLinkEl = document.getElementById('dm-profile-link');

    const formEl = document.getElementById('dm-form');
    const inputEl = document.getElementById('dm-input');
    const sendBtnEl = document.getElementById('dm-send-btn');

    const userSearchInput = document.getElementById('dm-user-search-input');
    const userSearchResults = document.getElementById('dm-user-search-results');

    let selectedThreadId = null;
    let selectedOtherUser = null;
    let pollTimer = null;
    let searchTimer = null;

    function setSelectedThreadFromStorage() {
        const saved = localStorage.getItem('selected_dm_thread_id');
        if (!saved) {
            selectedThreadId = null;
            return;
        }
        const id = Number(saved);
        selectedThreadId = Number.isFinite(id) ? id : null;
    }

    function persistSelectedThread() {
        if (!selectedThreadId) {
            localStorage.removeItem('selected_dm_thread_id');
            return;
        }
        localStorage.setItem('selected_dm_thread_id', String(selectedThreadId));
    }

    function setComposerEnabled(enabled) {
        inputEl.disabled = !enabled;
        sendBtnEl.disabled = !enabled;
        if (!enabled) inputEl.value = '';
    }

    function setHeader(otherUser) {
        if (!otherUser) {
            titleEl.textContent = 'Select a conversation';
            profileLinkEl.classList.add('hidden');
            profileLinkEl.href = '#';
            return;
        }
        titleEl.textContent = otherUser.display_name || otherUser.username;
        profileLinkEl.href = otherUser.profile_url || (`/u/${otherUser.username}/`);
        profileLinkEl.classList.remove('hidden');
    }

    function renderThreads(threads) {
        if (!threads || threads.length === 0) {
            threadsEl.innerHTML = '<div class="text-sm text-gray-400">No conversations yet. Search a user to start.</div>';
            return;
        }

        threadsEl.innerHTML = threads.map(t => {
            const other = t.other_user;
            const isSelected = t.id === selectedThreadId;
            const avatar = other && other.avatar
                ? `<img src="${other.avatar}" class="w-full h-full object-cover" />`
                : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-xs font-bold text-white">${(other?.username?.[0] || '?').toUpperCase()}</div>`;

            const lastText = t.last_message?.text ? t.last_message.text : 'No messages yet';

            return `
                <button class="dm-thread w-full text-left px-3 py-3 rounded-2xl border transition ${isSelected ? 'bg-white/10 border-cyan-500/30' : 'bg-white/5 border-white/10 hover:bg-white/10'}" data-id="${t.id}">
                    <div class="flex items-center gap-3">
                        <div class="w-10 h-10 rounded-full overflow-hidden border border-white/10 shrink-0">${avatar}</div>
                        <div class="min-w-0 flex-1">
                            <div class="text-sm font-bold truncate">${other?.display_name || other?.username || 'Unknown'}</div>
                            <div class="text-xs text-gray-500 truncate">${lastText}</div>
                        </div>
                        <i class="fas fa-chevron-right text-xs text-gray-600"></i>
                    </div>
                </button>
            `;
        }).join('');

        threadsEl.querySelectorAll('.dm-thread').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = Number(btn.getAttribute('data-id'));
                if (!Number.isFinite(id)) return;
                selectedThreadId = id;
                persistSelectedThread();
                loadThreads(true);
            });
        });
    }

    async function loadThreads(alsoLoadMessages = false) {
        const res = await authFetch('/api/dm/threads/');
        if (!res.ok) {
            threadsEl.innerHTML = '<div class="text-sm text-gray-400">Unable to load inbox.</div>';
            return;
        }

        const threads = await res.json();

        // Fix selection
        if (selectedThreadId) {
            const found = threads.find(t => t.id === selectedThreadId);
            if (!found) {
                selectedThreadId = null;
                selectedOtherUser = null;
                persistSelectedThread();
            } else {
                selectedOtherUser = found.other_user;
            }
        }

        if (!selectedThreadId && threads.length) {
            selectedThreadId = threads[0].id;
            selectedOtherUser = threads[0].other_user;
            persistSelectedThread();
            alsoLoadMessages = true;
        }

        setHeader(selectedOtherUser);
        setComposerEnabled(!!selectedThreadId);

        renderThreads(threads);

        if (alsoLoadMessages && selectedThreadId) {
            await loadMessages();
        }
    }

    function renderMessages(messages) {
        messagesEl.innerHTML = '';

        if (!messages || messages.length === 0) {
            messagesEl.innerHTML = '<div class="text-center text-gray-500 py-20"><p>No messages yet. Say hi!</p></div>';
            return;
        }

        messages.forEach(msg => {
            const isMe = msg.is_me;
            const div = document.createElement('div');
            div.className = `flex gap-3 mb-4 ${isMe ? 'flex-row-reverse' : 'flex-row'}`;

            const avatarHtml = `
                <div class="w-8 h-8 rounded-full bg-gray-700 overflow-hidden border border-white/20 shrink-0 mt-1">
                    ${msg.avatar
                        ? `<img src="${msg.avatar}" class="w-full h-full object-cover">`
                        : `<div class="w-full h-full bg-purple-500 flex items-center justify-center text-[10px] font-bold">${msg.username[0].toUpperCase()}</div>`
                    }
                </div>
            `;

            const bubbleClass = isMe
                ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white rounded-l-2xl rounded-tr-2xl'
                : 'bg-white/10 backdrop-blur-md border border-white/10 text-white rounded-r-2xl rounded-tl-2xl';

            const deleteBtn = isMe
                ? `<button class="dm-delete-msg text-xs text-red-400 hover:text-red-300 ml-2 opacity-50 hover:opacity-100 transition" data-id="${msg.id}"><i class="fas fa-trash"></i></button>`
                : '';

            div.innerHTML = `
                ${avatarHtml}
                <div class="flex flex-col max-w-[70%] ${isMe ? 'items-end' : 'items-start'}">
                    <div class="flex items-center gap-2 mb-1 px-1">
                        <span class="text-[10px] font-bold text-gray-400 uppercase tracking-wide">${msg.username}</span>
                        ${deleteBtn}
                    </div>
                    <div class="${bubbleClass} px-4 py-2 shadow-sm break-words text-sm leading-relaxed">${msg.text}</div>
                    <span class="text-[9px] text-gray-500 mt-1 px-1">${new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;

            messagesEl.appendChild(div);
        });

        messagesEl.querySelectorAll('.dm-delete-msg').forEach(btn => {
            btn.addEventListener('click', deleteMessage);
        });

        messagesEl.scrollTop = messagesEl.scrollHeight;
    }

    async function loadMessages() {
        if (!selectedThreadId) return;
        const res = await authFetch(`/api/dm/threads/${selectedThreadId}/messages/`);
        if (!res.ok) {
            if (res.status === 403) {
                messagesEl.innerHTML = '<div class="text-center mt-10"><p class="text-gray-400">You are not allowed to view this chat.</p></div>';
            }
            return;
        }
        const messages = await res.json();
        renderMessages(messages);
    }

    async function deleteMessage(e) {
        if (!confirm('Delete this message?')) return;
        const id = e.currentTarget.getAttribute('data-id');
        const res = await authFetch(`/api/dm/messages/${id}/`, { method: 'DELETE' });
        if (res.ok) {
            await loadMessages();
            await loadThreads(false);
        }
    }

    formEl.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!selectedThreadId) return;

        const text = inputEl.value.trim();
        if (!text) return;

        inputEl.value = '';

        const res = await authFetch(`/api/dm/threads/${selectedThreadId}/messages/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (res.ok) {
            await loadMessages();
            await loadThreads(false);
        }
    });

    async function createOrGetThread(username) {
        const res = await authFetch('/api/dm/threads/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username }),
        });

        if (!res.ok) {
            const data = await res.json().catch(() => ({}));
            showToast(data.detail || 'Unable to start chat', 'error');
            return null;
        }
        return await res.json();
    }

    async function performUserSearch(query) {
        if (!query || query.trim().length < 2) {
            userSearchResults.classList.add('hidden');
            userSearchResults.innerHTML = '';
            return;
        }

        const res = await authFetch(`/api/search/users/?q=${encodeURIComponent(query.trim())}`);
        if (!res.ok) {
            userSearchResults.classList.add('hidden');
            return;
        }

        const users = await res.json();
        if (!users.length) {
            userSearchResults.innerHTML = '<div class="px-4 py-4 text-sm text-gray-400">No users found</div>';
            userSearchResults.classList.remove('hidden');
            return;
        }

        userSearchResults.innerHTML = users.map(u => {
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
                    <button class="btn-secondary text-xs dm-start-btn" data-username="${u.username}">Message</button>
                </div>
            `;
        }).join('');

        userSearchResults.classList.remove('hidden');

        userSearchResults.querySelectorAll('.dm-start-btn').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const username = e.currentTarget.getAttribute('data-username');
                const thread = await createOrGetThread(username);
                if (!thread) return;

                selectedThreadId = thread.id;
                selectedOtherUser = thread.other_user;
                persistSelectedThread();

                userSearchInput.value = '';
                userSearchResults.classList.add('hidden');

                await loadThreads(true);
                showToast(`Chat started with @${username}`, 'success');
            });
        });
    }

    userSearchInput.addEventListener('input', (e) => {
        clearTimeout(searchTimer);
        const q = e.target.value;
        searchTimer = setTimeout(() => performUserSearch(q), 250);
    });

    document.addEventListener('click', (e) => {
        if (!userSearchResults.contains(e.target) && !userSearchInput.contains(e.target)) {
            userSearchResults.classList.add('hidden');
        }
    });

    async function startPolling() {
        if (pollTimer) clearInterval(pollTimer);
        pollTimer = setInterval(() => {
            if (selectedThreadId) loadMessages();
        }, 3000);
    }

    (async () => {
        if (!localStorage.getItem('access')) {
            threadsEl.innerHTML = '<div class="text-center mt-10"><p class="text-gray-400 mb-4">Please login to use direct messages.</p><a href="/" class="btn-primary">Login</a></div>';
            return;
        }

        setSelectedThreadFromStorage();
        await loadThreads(true);
        await startPolling();
    })();
}
