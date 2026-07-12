/**
 * 认证系统 - 自建PHP后端
 * 后端地址: https://skjh.2026027.xyz/api.php
 */
const Auth = {
    users: {},              // 内存缓存 { username: { data } }
    SAVE_KEY: 'xiuxian_game_data_v2',

    load() {
        try {
            const d = localStorage.getItem(this.SAVE_KEY);
            if (d) this.users = JSON.parse(d);
        } catch(e) { this.users = {}; }
    },

    save() {
        try {
            localStorage.setItem(this.SAVE_KEY, JSON.stringify(this.users));
        } catch(e) {}
    },

    // 后端API请求
    async apiRequest(action, params = {}) {
        const baseUrl = 'https://skjh.2026027.xyz/api.php';
        const url = new URL(baseUrl);
        url.searchParams.append('action', action);
        for (const [key, value] of Object.entries(params)) {
            url.searchParams.append(key, value);
        }
        try {
            const res = await fetch(url.toString(), {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
            });
            return await res.json();
        } catch (e) {
            return { code: 0, msg: '网络错误' };
        }
    },

    async register(username, password) {
        return await this.apiRequest('register', { name: username, pwd: password });
    },

    async login(username, password) {
        const result = await this.apiRequest('login', { name: username, pwd: password });
        if (result.code === 200 && result.data) {
            this.users[username] = { data: result.data };
            this.save();
            return { success: true, data: result.data };
        } else {
            return { success: false, msg: result.msg };
        }
    },

    async saveToServer(username, gameData) {
        const payload = btoa(encodeURIComponent(JSON.stringify(gameData)));
        const result = await this.apiRequest('save', { name: username, data: payload });
        return result.code === 200;
    },

    async loadFromServer(username) {
        const result = await this.apiRequest('load', { name: username });
        if (result.code === 200 && result.data) {
            return result.data;
        }
        return null;
    },

    getUserData(username) {
        return this.users[username]?.data || null;
    },

    updateCache(username, data) {
        if (!this.users[username]) this.users[username] = {};
        this.users[username].data = data;
        this.save();
    }
};