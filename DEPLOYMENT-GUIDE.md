# 📦 POLYMARKET TRADING AGENT - DEPLOYMENT GUIDE

## 🚀 Complete Deployment Pipeline

This guide provides step-by-step instructions for packaging and deploying the Polymarket Trading Agent to production servers.

### 📋 Prerequisites

#### Development Machine (for packaging):
- **OS**: Linux, macOS, or WSL on Windows
- **Node.js**: 14.0.0+ (for validation scripts)
- **Python**: 3.6+ (for HTTP server testing)
- **Bash**: 4.0+ (for deployment scripts)
- **Tools**: tar, gzip, curl, sha256sum

#### Production Server:
- **OS**: Ubuntu 18.04+, CentOS 7+, or similar Linux distribution
- **Memory**: 4GB minimum (8GB recommended)
- **Storage**: 500MB available (2GB recommended)
- **Network**: 10 Mbps minimum internet connection
- **Web Server**: Nginx (automatically installed if not present)
- **Node.js**: 14.0.0+ (automatically installed if not present)
- **Privileges**: sudo/root access for installation

---

## 📦 Step 1: Build Deployment Package

### Run the Build Script
```bash
# From the project root directory
./scripts/build-deployment.sh
```

### Build Process Overview
The build script performs:
1. **Validation**: Checks all required files are present
2. **Packaging**: Copies application files to build directory
3. **Configuration**: Creates deployment configuration files
4. **Scripts**: Generates installation, validation, and uninstall scripts
5. **Optimization**: Basic JavaScript optimization
6. **Checksums**: Generates file integrity checksums
7. **Archive**: Creates compressed deployment package

### Build Output
```
dist/
├── polymarket-trading-agent-v1.0.0.tar.gz    # Main deployment package
├── deployment-info.json                       # Package metadata
└── QUICK-START.md                            # Quick installation guide
```

---

## 🧪 Step 2: Test the Package (Optional but Recommended)

### Run Installation Test
```bash
# Test the package integrity and installation scripts
./scripts/test-installation.sh
```

### Test Results
The test validates:
- ✅ All required files are present
- ✅ JavaScript syntax is correct
- ✅ HTML structure is valid
- ✅ File checksums match
- ✅ HTTP server functionality works
- ✅ Installation scripts are executable and syntactically correct
- ✅ Documentation is present and complete

---

## 🚚 Step 3: Transfer to Production Server

### Method 1: SCP (Secure Copy)
```bash
# Copy package to production server
scp dist/polymarket-trading-agent-v1.0.0.tar.gz user@your-server:/tmp/
```

### Method 2: Direct Download (if package is hosted)
```bash
# On the production server
wget https://your-domain.com/releases/polymarket-trading-agent-v1.0.0.tar.gz -O /tmp/polymarket-trading-agent-v1.0.0.tar.gz
```

### Method 3: Git Repository (if committed)
```bash
# On the production server
git clone https://github.com/your-username/polymarket-agent.git
cd polymarket-agent
./scripts/build-deployment.sh
```

---

## ⚙️ Step 4: Server Installation

### Extract and Install
```bash
# On the production server (requires sudo)
cd /tmp
tar -xzf polymarket-trading-agent-v1.0.0.tar.gz
cd polymarket-trading-agent-v1.0.0

# Run installation script
sudo ./install.sh
```

### Installation Process
The installation script will:

1. **System Checks**: Verify OS compatibility and requirements
2. **Dependencies**: Install Nginx and Node.js if not present
3. **User Creation**: Create dedicated service user (`polymarket`)
4. **File Deployment**: Copy files to `/var/www/polymarket-agent/`
5. **Permissions**: Set appropriate file and directory permissions
6. **Web Server**: Configure Nginx with production settings
7. **Services**: Create systemd service (for future backend)
8. **Logging**: Set up log rotation
9. **Health Checks**: Verify installation integrity

### Installation Output Example
```
🚀 POLYMARKET TRADING AGENT - SERVER INSTALLER
===============================================
🔍 Checking system requirements...
✅ System requirements satisfied
👤 Creating service user...
✅ Service user 'polymarket' created
📁 Setting up installation directory...
✅ Installation directory ready: /var/www/polymarket-agent
📦 Installing application files...
✅ Application files installed
📚 Installing dependencies...
✅ Dependencies installed
🌐 Configuring Nginx...
✅ Nginx configured and reloaded
⚙️ Creating systemd service...
✅ Systemd service created (not started)
📝 Setting up log rotation...
✅ Log rotation configured
🚀 Creating startup script...
✅ Startup script created
🏥 Running health checks...
✅ Main application file readable
✅ Nginx is running
✅ HTTP health check passed

🎉 INSTALLATION COMPLETE!
===============================================
📍 Installation Directory: /var/www/polymarket-agent
🌐 Web Interface: http://localhost/
🔧 QA Testing: http://localhost/emergency-qa-test.html
📊 Health Check: http://localhost/health
```

---

## ✅ Step 5: Validate Deployment

### Run Validation Script
```bash
# From the extracted package directory
./validate-deployment.sh
```

### Manual Validation
```bash
# Check web interface
curl http://localhost/

# Check health endpoint
curl http://localhost/health

# Check QA testing page
curl http://localhost/emergency-qa-test.html

# Check Nginx status
sudo systemctl status nginx

# Check file permissions
ls -la /var/www/polymarket-agent/
```

### Validation Checklist
- ✅ Main application loads at `http://localhost/`
- ✅ QA testing page accessible at `http://localhost/emergency-qa-test.html`
- ✅ Health check returns "OK" at `http://localhost/health`
- ✅ All JavaScript files load without errors
- ✅ PWA manifest and service worker are accessible
- ✅ File permissions are correct
- ✅ Nginx is running and configured properly

---

## 🧪 Step 6: Run QA Tests

### Access QA Testing Interface
```bash
# Open in browser or test with curl
curl http://localhost/emergency-qa-test.html
```

### QA Testing Process
1. **Visit**: `http://localhost/emergency-qa-test.html`
2. **Run**: Click "🔍 Full Diagnostics" to test all systems
3. **Fix**: If issues found, click "🔧 Emergency Fixes"
4. **Verify**: Click "✅ Verify Systems" to confirm fixes
5. **Monitor**: Check all status indicators show green

### Expected QA Results
- ✅ **WebSocket**: Connected or polling fallback active
- ✅ **API**: Market data loading or fallback data available
- ✅ **Smart Orders**: Order validation working
- ✅ **Wallet**: MetaMask detection working
- ✅ **Database**: IndexedDB functional
- ✅ **Overall**: All systems operational

---

## 🌐 Step 7: Configure Domain (Optional)

### For Custom Domain
```bash
# Edit Nginx configuration
sudo nano /etc/nginx/sites-available/polymarket-agent

# Update server_name
server_name your-domain.com www.your-domain.com;

# Reload Nginx
sudo nginx -t && sudo systemctl reload nginx
```

### SSL Certificate (Recommended)
```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx

# Get SSL certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

---

## 🔧 Troubleshooting

### Common Issues

#### 1. Installation Script Fails
```bash
# Check system requirements
nginx -v
node -v

# Check permissions
sudo ls -la /var/www/

# Check disk space
df -h

# Review installation logs
sudo journalctl -f
```

#### 2. Web Interface Not Loading
```bash
# Check Nginx status
sudo systemctl status nginx

# Check Nginx configuration
sudo nginx -t

# Check file permissions
ls -la /var/www/polymarket-agent/

# Check Nginx error logs
sudo tail -f /var/log/nginx/error.log
```

#### 3. QA Tests Failing
```bash
# Access emergency QA interface
http://localhost/emergency-qa-test.html

# Run automatic diagnostics and fixes
# Click "Full Diagnostics" then "Emergency Fixes"

# Check browser console for JavaScript errors
# Open Developer Tools (F12) and check Console tab
```

#### 4. Permission Issues
```bash
# Fix file permissions
sudo chown -R polymarket:polymarket /var/www/polymarket-agent/
sudo find /var/www/polymarket-agent/ -type f -exec chmod 644 {} \;
sudo find /var/www/polymarket-agent/ -type d -exec chmod 755 {} \;
```

### Getting Help

1. **Built-in QA Tools**: Use the emergency QA testing interface for automatic problem detection and fixing
2. **Health Monitoring**: Check the `/health` endpoint for system status
3. **Log Files**: Check Nginx logs at `/var/log/nginx/`
4. **Validation Script**: Re-run `./validate-deployment.sh` after fixes

---

## 🔄 Updates and Maintenance

### Updating the Application
```bash
# 1. Download new package
wget https://your-domain.com/releases/polymarket-trading-agent-v1.1.0.tar.gz

# 2. Extract new version
tar -xzf polymarket-trading-agent-v1.1.0.tar.gz
cd polymarket-trading-agent-v1.1.0

# 3. Backup current installation
sudo cp -r /var/www/polymarket-agent /var/www/polymarket-agent.backup

# 4. Install new version
sudo ./install.sh

# 5. Validate update
./validate-deployment.sh
```

### Uninstalling
```bash
# Run uninstall script
sudo ./uninstall.sh
```

### Monitoring
```bash
# Check health endpoint
curl http://localhost/health

# Monitor Nginx logs
sudo tail -f /var/log/nginx/access.log

# Monitor system resources
htop
df -h
```

---

## 📊 Production Configuration

### Performance Tuning

#### Nginx Optimization
```nginx
# /etc/nginx/sites-available/polymarket-agent
server {
    # Enable gzip compression
    gzip on;
    gzip_types text/css application/javascript application/json;
    
    # Set cache headers
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}
```

#### System Resources
```bash
# Monitor memory usage
free -h

# Monitor disk usage
df -h

# Monitor network usage
iftop
```

### Security Hardening

#### Firewall Configuration
```bash
# Enable firewall
sudo ufw enable

# Allow HTTP/HTTPS
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Allow SSH (be careful!)
sudo ufw allow 22/tcp
```

#### Security Headers (Already configured in install.sh)
- X-Frame-Options: SAMEORIGIN
- X-Content-Type-Options: nosniff
- X-XSS-Protection: 1; mode=block
- Referrer-Policy: strict-origin-when-cross-origin

---

## ✅ Success Criteria

### Deployment is successful when:

1. **✅ Web Interface**: Application loads at configured domain/IP
2. **✅ QA Testing**: All diagnostics pass in emergency QA interface
3. **✅ Health Check**: `/health` endpoint returns "OK"
4. **✅ Core Features**: WebSocket/polling, API integration, wallet connection work
5. **✅ PWA Features**: Service worker registers, app is installable
6. **✅ Security**: All security headers present, HTTPS working (if configured)
7. **✅ Performance**: Page loads in <3 seconds, responsive interface
8. **✅ Monitoring**: Health checks pass, no error logs

### Ready for Production Use:
- 🎯 Trading interface functional
- 🔒 Security measures active
- 📊 Monitoring systems operational
- 🚨 Emergency fixes available
- 📖 Documentation accessible
- ✅ All systems validated

---

**🎉 DEPLOYMENT COMPLETE!**

Your Polymarket Trading Agent is now ready for production use with enterprise-grade reliability, comprehensive error handling, and professional deployment practices.

**Next Steps**: Access your application, connect MetaMask wallet, configure trading strategies, and begin automated prediction market trading!

---

*Deployment Guide Version: 1.0*  
*Last Updated: December 2024*  
*Support: Use built-in QA testing interface for automatic diagnostics*