(function () {
    const STORAGE_KEYS = {
        messages: 'my_messages',
        deleted: 'my_deleted_messages'
    };

    const CONFIG = window.__MESSAGE_SYNC_CONFIG__ || {};
    const API_BASE = typeof CONFIG.apiBase === 'string' ? CONFIG.apiBase.trim() : '';
    const SUPABASE_URL = typeof CONFIG.supabaseUrl === 'string' ? CONFIG.supabaseUrl.trim().replace(/\/$/, '') : '';
    const SUPABASE_ANON_KEY = typeof CONFIG.supabaseAnonKey === 'string' ? CONFIG.supabaseAnonKey.trim() : '';
    const SUPABASE_TABLE = typeof CONFIG.supabaseTable === 'string' && CONFIG.supabaseTable.trim()
        ? CONFIG.supabaseTable.trim()
        : 'message_collections';
    const SUPABASE_ENABLED = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

    function readLocal(key) {
        try {
            const raw = localStorage.getItem(key);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed : [];
        } catch {
            return [];
        }
    }

    function writeLocal(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(Array.isArray(value) ? value : []));
        } catch {
        }
    }

    async function requestJson(path, options = {}) {
        const requestPath = API_BASE ? `${API_BASE}${path}` : path;

        const response = await fetch(requestPath, {
            ...options,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                ...(options.headers || {})
            }
        });

        if (!response.ok) {
            throw new Error(`request failed: ${response.status}`);
        }

        const text = await response.text();
        if (!text) return [];

        const parsed = JSON.parse(text);
        return Array.isArray(parsed) ? parsed : [];
    }

    function getSupabaseHeaders(extraHeaders = {}) {
        return {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            Accept: 'application/json',
            'Content-Type': 'application/json',
            ...extraHeaders
        };
    }

    async function requestSupabaseCollection(name) {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?select=payload&name=eq.${encodeURIComponent(name)}&limit=1`,
            {
                headers: getSupabaseHeaders()
            }
        );

        if (!response.ok) {
            throw new Error(`supabase read failed: ${response.status}`);
        }

        const rows = await response.json();
        if (!Array.isArray(rows) || !rows.length) {
            return [];
        }

        const payload = rows[0] && rows[0].payload;
        return Array.isArray(payload) ? payload : [];
    }

    async function writeSupabaseCollection(name, value) {
        const data = Array.isArray(value) ? value : [];
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/${SUPABASE_TABLE}?on_conflict=name`,
            {
                method: 'POST',
                headers: getSupabaseHeaders({
                    Prefer: 'resolution=merge-duplicates,return=representation'
                }),
                body: JSON.stringify([{ name, payload: data }])
            }
        );

        if (!response.ok) {
            throw new Error(`supabase write failed: ${response.status}`);
        }

        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0].payload)) {
            return rows[0].payload;
        }

        return data;
    }

    async function readCollection(path, key) {
        if (SUPABASE_ENABLED) {
            try {
                const remote = await requestSupabaseCollection(key);
                if (remote.length > 0) {
                    writeLocal(key, remote);
                    return remote;
                }

                const local = readLocal(key);
                if (local.length > 0) {
                    await writeSupabaseCollection(key, local);
                    return local;
                }

                return [];
            } catch {
                return readLocal(key);
            }
        }

        try {
            const remote = await requestJson(path);
            if (remote.length === 0) {
                const local = readLocal(key);
                if (local.length > 0) {
                    await writeCollection(path, key, local);
                    return local;
                }
            }

            writeLocal(key, remote);
            return remote;
        } catch {
            return readLocal(key);
        }
    }

    async function writeCollection(path, key, value) {
        const data = Array.isArray(value) ? value : [];
        writeLocal(key, data);

        if (SUPABASE_ENABLED) {
            try {
                const saved = await writeSupabaseCollection(key, data);
                writeLocal(key, saved);
                return saved;
            } catch {
                return data;
            }
        }

        try {
            const saved = await requestJson(path, {
                method: 'POST',
                body: JSON.stringify(data)
            });

            writeLocal(key, saved);
            return saved;
        } catch {
            return data;
        }
    }

    window.MessageSyncStore = {
        getMessages: () => readCollection('/api/messages', STORAGE_KEYS.messages),
        saveMessages: (messages) => writeCollection('/api/messages', STORAGE_KEYS.messages, messages),
        getDeletedMessages: () => readCollection('/api/deleted', STORAGE_KEYS.deleted),
        saveDeletedMessages: (messages) => writeCollection('/api/deleted', STORAGE_KEYS.deleted, messages)
    };
})();