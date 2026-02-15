
const API_BASE = window.location.hostname === "localhost"
    ? "http://localhost:4000/api/auth"
    : "https://api.mequest.com/api/auth";

const form = document.getElementById('auth-form');
const emailInput = document.getElementById('email');
const passwordInput = document.getElementById('password');
const nicknameInput = document.getElementById('nickname');
const nicknameGroup = document.getElementById('nickname-group');
const submitBtn = document.getElementById('submit-btn');
const toggleBtn = document.getElementById('toggle-btn');
const formTitle = document.getElementById('form-title');
const messageDiv = document.getElementById('message');

let isLoginMode = true;

toggleBtn.addEventListener('click', () => {
    isLoginMode = !isLoginMode;
    if (isLoginMode) {
        formTitle.textContent = '로그인';
        submitBtn.textContent = '로그인';
        nicknameGroup.style.display = 'none';
        document.getElementById('toggle-text').textContent = '계정이 없으신가요?';
        toggleBtn.textContent = '회원가입';
        nicknameInput.required = false;
    } else {
        formTitle.textContent = '회원가입';
        submitBtn.textContent = '회원가입';
        nicknameGroup.style.display = 'block';
        document.getElementById('toggle-text').textContent = '이미 계정이 있으신가요?';
        toggleBtn.textContent = '로그인';
        nicknameInput.required = true;
    }
    messageDiv.textContent = '';
});

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    messageDiv.textContent = '';

    const email = emailInput.value;
    const password = passwordInput.value;
    const nickname = nicknameInput.value;

    const endpoint = isLoginMode ? '/login' : '/register';
    const body = isLoginMode ? { email, password } : { email, password, nickname };

    try {
        const res = await fetch(`${API_BASE}${endpoint}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        const data = await res.json();

        if (!res.ok) {
            throw new Error(data.message || '오류가 발생했습니다.');
        }

        if (isLoginMode) {
            localStorage.setItem('token', data.token);
            localStorage.setItem('user', JSON.stringify(data.user)); // Store minimal user info
            window.location.href = 'index.html'; // Redirect to main page
        } else {
            alert('회원가입 성공! 로그인해주세요.');
            toggleBtn.click(); // Switch to login mode
        }

    } catch (err) {
        messageDiv.textContent = err.message;
    }
});
