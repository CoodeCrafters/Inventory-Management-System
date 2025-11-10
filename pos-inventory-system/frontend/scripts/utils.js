class Utils {
    static currentLocation = {
        timezone: 'Asia/Kolkata',
        city: 'India'
    };

    static databaseCheckInterval = null;

    static async initialize() {
        await this.startDatabaseMonitoring(); // Start monitoring immediately
        await this.detectLocation();
        this.startClock();
        this.handleKeyboardShortcuts();
        this.redirectIfAuthenticated();
        
        // Auto-focus username field
        const usernameField = document.getElementById('username');
        if (usernameField) {
            usernameField.focus();
        }
    }

    // NEW: Database connection monitoring
    static async startDatabaseMonitoring() {
        // Check immediately
        await this.checkDatabaseConnection();
        
        // Set up interval for every 30 seconds
        this.databaseCheckInterval = setInterval(async () => {
            await this.checkDatabaseConnection();
        }, 30000); // 30 seconds
    }

    static async checkDatabaseConnection() {
        const dbStatus = document.querySelector('.system-status .status-item:nth-child(2) .status-online');
        const dbText = document.querySelector('.system-status .status-item:nth-child(2)');

        try {
            const response = await fetch('http://localhost:5000/api/test-db', {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            const data = await response.json();

            if (data.success) {
                dbStatus.style.color = '#28a745'; // Green for connected
                dbStatus.style.backgroundColor = '#28a745';
                dbText.innerHTML = 'Database: <span style="color: #28a745">Connected</span>';
                console.log('Database connected:', data.timestamp);
                return true;
            } else {
                throw new Error('Database not connected');
            }
        } catch (error) {
            dbStatus.style.color = '#dc3545'; // Red for offline
            dbStatus.style.backgroundColor = '#dc3545';
            dbText.innerHTML = 'Database: <span style="color: #dc3545">Offline</span>';
            console.error('Database connection check failed:', error);
            return false;
        }
    }

    // NEW: Email verification methods
    static async checkUsernameExists(username) {
        try {
            const response = await fetch('http://localhost:5000/api/check-username', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Username check failed:', error);
            return { success: false, message: 'Network error' };
        }
    }

    static async sendVerificationCode(username) {
        try {
            const response = await fetch('http://localhost:5000/api/send-verification', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Verification code send failed:', error);
            return { success: false, message: 'Network error' };
        }
    }

    static async verifyCode(username, code) {
        try {
            const response = await fetch('http://localhost:5000/api/verify-code', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username, code })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Code verification failed:', error);
            return { success: false, message: 'Network error' };
        }
    }

    static async checkOtpSentStatus(username) {
        try {
            const response = await fetch('http://localhost:5000/api/check-otp-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ username })
            });

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('OTP status check failed:', error);
            return { success: false, message: 'Network error' };
        }
    }

    // Rest of your existing methods remain the same...
    static async detectLocation() {
        try {
            if (navigator.geolocation) {
                const position = await new Promise((resolve, reject) => {
                    navigator.geolocation.getCurrentPosition(resolve, reject, {
                        timeout: 3000,
                        maximumAge: 300000
                    });
                });

                const { latitude, longitude } = position.coords;
                await this.getLocationFromCoordinates(latitude, longitude);
            } else {
                await this.getLocationFromIP();
            }
        } catch (error) {
            this.currentLocation = {
                timezone: 'Asia/Kolkata',
                city: 'India'
            };
            this.updateLocationDisplay();
        }
    }

    static async getLocationFromCoordinates(lat, lon) {
        try {
            const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`);
            const data = await response.json();
            
            this.currentLocation.city = data.city || data.locality || data.principalSubdivision || data.countryName;
            this.currentLocation.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
            this.updateLocationDisplay();
        } catch (error) {
            this.currentLocation.timezone = 'Asia/Kolkata';
            this.currentLocation.city = 'India';
            this.updateLocationDisplay();
        }
    }

    static async getLocationFromIP() {
        try {
            const response = await fetch('https://ipapi.co/json/');
            const data = await response.json();
            
            this.currentLocation.timezone = data.timezone;
            this.currentLocation.city = data.city || data.country_name;
            this.updateLocationDisplay();
        } catch (error) {
            this.currentLocation.timezone = 'Asia/Kolkata';
            this.currentLocation.city = 'India';
            this.updateLocationDisplay();
        }
    }

    static updateLocationDisplay() {
        // Location display removed as per design
    }

    static formatDateTime() {
        const now = new Date();
        const timezone = this.currentLocation.timezone || 'Asia/Kolkata';
        
        const formatter = new Intl.DateTimeFormat('en-US', {
            timeZone: timezone,
            weekday: 'long',
            year: 'numeric',
            month: 'short',
            day: '2-digit',
            hour12: false,
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit'
        });
        
        const parts = formatter.formatToParts(now);
        const date = `${parts.find(p => p.type === 'weekday').value}, ${parts.find(p => p.type === 'month').value} ${parts.find(p => p.type === 'day').value}, ${parts.find(p => p.type === 'year').value}`.toUpperCase();
        const time = `${parts.find(p => p.type === 'hour').value}:${parts.find(p => p.type === 'minute').value}:${parts.find(p => p.type === 'second').value}`;
        
        return { date, time };
    }

    static updateDateTimeDisplay() {
        const { date, time } = this.formatDateTime();
        
        const dateElement = document.getElementById('currentDate');
        const timeElement = document.getElementById('currentTime');
        
        if (dateElement) dateElement.textContent = date;
        if (timeElement) timeElement.textContent = time;
    }

    static startClock() {
        this.updateDateTimeDisplay();
        setInterval(() => this.updateDateTimeDisplay(), 1000);
    }

    static showAlert(message, type = 'error') {
    console.log('💬 showAlert called:', message, type);
    
    const alertDiv = document.getElementById('errorAlert');
    console.log('💬 Alert div found:', !!alertDiv);
    
    if (alertDiv) {
        alertDiv.textContent = message;
        alertDiv.className = `alert alert-${type}`;
        alertDiv.style.display = 'block';
        console.log('💬 Alert shown');
        
        setTimeout(() => {
            console.log('💬 Hiding alert');
            alertDiv.style.display = 'none';
        }, 5000);
    } else {
        console.log('💬 ERROR: Alert div not found!');
    }
}

    static hideAlert() {
        const alertDiv = document.getElementById('errorAlert');
        if (alertDiv) {
            alertDiv.style.display = 'none';
        }
    }

    static setButtonLoading(isLoading) {
        const loginBtn = document.querySelector('.login-btn');
        const loginText = document.getElementById('loginText');
        const loginSpinner = document.getElementById('loginSpinner');

        if (isLoading) {
            loginText.style.display = 'none';
            loginSpinner.style.display = 'block';
            loginBtn.disabled = true;
            loginBtn.style.background = '#6c757d';
            loginBtn.style.cursor = 'not-allowed';
            loginBtn.textContent = 'AUTHENTICATING...';
        } else {
            loginText.style.display = 'block';
            loginSpinner.style.display = 'none';
            loginBtn.disabled = false;
            loginBtn.style.background = '#007bff';
            loginBtn.style.cursor = 'pointer';
            loginBtn.textContent = 'SIGN IN';
        }
    }

    static getApiBaseUrl() {
        return 'http://localhost:5000/api';
    }

    static getToken() {
        return sessionStorage.getItem('pos_token');
    }

    static setToken(token) {
        sessionStorage.setItem('pos_token', token);
    }

    static removeToken() {
        sessionStorage.removeItem('pos_token');
        sessionStorage.removeItem('pos_employee');
    }

    static getEmployee() {
        const employee = sessionStorage.getItem('pos_employee');
        return employee ? JSON.parse(employee) : null;
    }

    static isAuthenticated() {
        return !!this.getToken();
    }

    static redirectIfAuthenticated() {
        if (this.isAuthenticated()) {
            window.location.href = '/dashboard';
        }
    }

    static handleKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F2') {
                e.preventDefault();
                document.getElementById('username').value = 'admin';
                document.getElementById('password').value = 'password123';
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }
            
            if (e.key === 'F12') {
                e.preventDefault();
                this.showSystemInfo();
            }
            
            if (e.key === 'Enter' && document.activeElement.tagName !== 'BUTTON') {
                document.getElementById('loginForm').dispatchEvent(new Event('submit'));
            }
        });
    }

    static showSystemInfo() {
        const info = `
POS System Information:
- Version: 2.1.4
- Location: ${this.currentLocation.city}
- Timezone: ${this.currentLocation.timezone}
- Database: ${document.querySelector('.system-status .status-item:nth-child(2)').textContent.replace('Database: ', '')}
- Last Update: ${new Date().toLocaleDateString()}
        `;
        alert(info.trim());
    }
}



// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    Utils.initialize();
});
