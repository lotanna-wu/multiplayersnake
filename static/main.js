(function() {
    'use strict';

    const MAX_ROOM_NAME_LENGTH = 20;
    const MAX_ROOM_ID_LENGTH = 100;
    const REFRESH_COOLDOWN = 2000; // 2 seconds
    const REQUEST_TIMEOUT = 10000; // 10 seconds

    const elements = {
        createBtn: document.getElementById("create-room"),
        joinBtn: document.getElementById("join-room"),
        roomIdInput: document.getElementById("room-id"),
        refreshBtn: document.getElementById("refresh-rooms"),
        roomName: document.getElementById("room-name"),
        isPublic: document.getElementById("public"),
        isNoBorders: document.getElementById("borders"),
        roomsContainer: document.getElementById("public-rooms")
    };

    let lastRefreshTime = 0;
    let isRefreshing = false;

    //utils
    const sanitizeInput = (input) => {
        if (typeof input !== 'string') return '';
        return input.trim().replace(/[<>'"&]/g, '');
    };

    const validateRoomName = (name) => {
        const sanitized = sanitizeInput(name);
        if (!sanitized) {
            return { valid: false, message: 'Room name is required' };
        }
        if (sanitized.length > MAX_ROOM_NAME_LENGTH) {
            return { valid: false, message: `Room name must be ${MAX_ROOM_NAME_LENGTH} characters or less` };
        }
        if (!/^[a-zA-Z0-9\s\-_]+$/.test(sanitized)) {
            return { valid: false, message: 'Room name can only contain letters, numbers, spaces, hyphens, and underscores' };
        }
        return { valid: true, value: sanitized };
    };

    const validateRoomId = (id) => {
        const sanitized = sanitizeInput(id);
        if (!sanitized) {
            return { valid: false, message: 'Room ID is required' };
        }
        if (sanitized.length > MAX_ROOM_ID_LENGTH) {
            return { valid: false, message: `Room ID must be ${MAX_ROOM_ID_LENGTH} characters or less` };
        }
        if (!/^[a-zA-Z0-9\-_]+$/.test(sanitized)) {
            return { valid: false, message: 'Invalid room ID format' };
        }
        return { valid: true, value: sanitized };
    };

    const showError = (message) => {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'error-message';
        errorDiv.textContent = message;
        errorDiv.style.cssText = `
            background: #111;
            border: 2px solid #00ff00;
            color: #c33;
            padding: 10px;
            margin: 10px 0;
            position: fixed;
            top: 20px;
            right: 20px;
            z-index: 1000;
            max-width: 300px;
        `;
        
        document.body.appendChild(errorDiv);
        
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 5000);
    };

    // const showError = (message) => {
    //     alert(message);
    // }

    const createAbortController = (timeoutMs) => {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        return { controller, timeoutId };
    };

    const createRoom = async () => {
        try {
            const nameValidation = validateRoomName(elements.roomName.value);
            if (!nameValidation.valid) {
                showError(nameValidation.message);
                return;
            }

            const isPublicChecked = elements.isPublic.checked;
            const isNoBordersChecked = elements.isNoBorders.checked;
            // const encodedName = encodeURIComponent(nameValidation.value);
            // const encodedPublic = encodeURIComponent(isPublicChecked);

            await fetch('/rooms', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    name: nameValidation.value,
                    public: isPublicChecked,
                    settings:{
                       borders: !isNoBordersChecked,
                       numPlayers: 2
                    } 
                })
            })
            .then(response => response.json())
            .then(data => {
            if (data.success) {
                window.location.href = data.redirectUrl;
            }else{
                throw new Error(data.details[0].msg)
            }
            });

            elements.createBtn.disabled = true;
            elements.createBtn.textContent = 'Creating...';

        } catch (error) {
            showError('Failed to create room. Please try again.');
            elements.createBtn.disabled = false;
            elements.createBtn.textContent = 'Create a room';
        }
    };

    const joinRoom = async () => {
        try {
            const idValidation = validateRoomId(elements.roomIdInput.value);
            if (!idValidation.valid) {
                showError(idValidation.message);
                return;
            }

            elements.joinBtn.disabled = true;
            elements.joinBtn.textContent = 'Joining...';

            window.location.href = `/rooms/${encodeURIComponent(idValidation.value)}`;
        } catch (error) {
            showError('Failed to join room. Please try again.');
            elements.joinBtn.disabled = false;
            elements.joinBtn.textContent = 'Join a room';
        }
    };

    const refreshRooms = async () => {
        const now = Date.now();
        
        if (isRefreshing || (now - lastRefreshTime) < REFRESH_COOLDOWN) {
            return;
        }

        isRefreshing = true;
        lastRefreshTime = now;
        
        const originalText = elements.refreshBtn.textContent;
        elements.refreshBtn.disabled = true;
        elements.refreshBtn.textContent = 'Refreshing...';

        const { controller, timeoutId } = createAbortController(REQUEST_TIMEOUT);

        try {
            const response = await fetch('/rooms', {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                },
                signal: controller.signal
            });
            clearTimeout(timeoutId);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (!contentType || !contentType.includes('application/json')) {
                throw new Error('Invalid response format');
            }

            const rooms = await response.json();

            if (!Array.isArray(rooms)) {
                throw new Error('Invalid rooms data');
            }

            elements.roomsContainer.innerHTML = '';

            if (rooms.length === 0) {
                const li = document.createElement('li');
                li.textContent = 'No public rooms available';
                li.style.fontStyle = 'italic';
                li.style.color = '#666';
                elements.roomsContainer.appendChild(li);
                return;
            }

            rooms.forEach((room) => {
                if (!room || typeof room !== 'object' || !room.id || !room.name) {
                    console.warn('Invalid room data:', room);
                    return;
                }

                const li = document.createElement('li');
                const a = document.createElement('a');
                
                const sanitizedName = sanitizeInput(room.name);
                const sanitizedId = sanitizeInput(room.id);
                
                if (!sanitizedName || !sanitizedId) {
                    console.warn('Invalid room data after sanitization:', room);
                    return;
                }

                a.href = `/rooms/${encodeURIComponent(sanitizedId)}`;
                a.textContent = sanitizedName;
                a.style.textDecoration = 'none';
                a.style.color = '#0066cc';
                
                a.addEventListener('mouseenter', () => {
                    a.style.textDecoration = 'underline';
                });
                a.addEventListener('mouseleave', () => {
                    a.style.textDecoration = 'none';
                });

                li.appendChild(a);
                elements.roomsContainer.appendChild(li);
            });

        } catch (error) {
            clearTimeout(timeoutId);            
            if (error.name === 'AbortError') {
                showError('Request timed out. Please try again.');
            } else {
                showError('Failed to load rooms. Please try again.');
            }

            elements.roomsContainer.innerHTML = '<li style="color: #c33; font-style: italic;">Failed to load rooms</li>';
        } finally {
            isRefreshing = false;
            elements.refreshBtn.disabled = false;
            elements.refreshBtn.textContent = originalText;
        }
    };

    const setupInputValidation = () => {
        elements.roomName.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > MAX_ROOM_NAME_LENGTH) {
                e.target.value = value.substring(0, MAX_ROOM_NAME_LENGTH);
            }
            e.target.value = e.target.value.replace(/[<>'"&]/g, '');
        });

        elements.roomIdInput.addEventListener('input', (e) => {
            const value = e.target.value;
            if (value.length > MAX_ROOM_ID_LENGTH) {
                e.target.value = value.substring(0, MAX_ROOM_ID_LENGTH);
            }
            e.target.value = e.target.value.replace(/[^a-zA-Z0-9\-_]/g, '');
        });

        elements.roomName.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                createRoom();
            }
        });

        elements.roomIdInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                joinRoom();
            }
        });
    };

    const init = () => {
        const missingElements = Object.entries(elements).filter(([key, element]) => !element);
        if (missingElements.length > 0) {
            console.error('Missing DOM elements:', missingElements.map(([key]) => key));
            return;
        }

        elements.refreshBtn.addEventListener("click", refreshRooms);
        elements.createBtn.addEventListener("click", createRoom);
        elements.joinBtn.addEventListener("click", joinRoom);

        setupInputValidation();

        refreshRooms();

        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) {
                setTimeout(refreshRooms, 20000);
            }
        });
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
