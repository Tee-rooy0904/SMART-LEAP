<?php /** @var string $baseUrl */ ?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CSWDD-SMART LEAP Admin System</title>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="<?= $baseUrl ?>/assets/css/shared/styles.css" rel="stylesheet">
</head>
<body>
    <!-- Professional Login Page -->
    <div id="loginPage" class="login-page">
        <div class="login-container">
            <!-- Left Panel - White with Logo -->
            <div class="login-left-panel">
                <div class="logo-container">
                    <img src="<?= $baseUrl ?>/assets/img/SMARTLEAP.png" alt="CSWDD Logo" class="cswdd-logo-img">
                </div>
                
                <div class="system-title">
                    <h2>SMART LEAP</h2>
                </div>
            </div>
            
            <!-- Right Panel - White with Login Form -->
            <div class="login-right-panel">
                <div class="login-header">
                    <h1>LOGIN</h1>
                    <p class="mb-0 text-muted">Administrator and Project Officer access only.</p>
                </div>
                
                <form id="loginForm" class="login-form" novalidate>
                    <input type="hidden" name="entryPoint" value="staff">
                    <div class="form-group">
                        <label for="email">Email</label>
                        <input type="email" id="email" name="email" placeholder="username" required>
                    </div>
                    
                    <div class="form-group">
                        <label for="password">Password</label>
                        <input type="password" id="password" name="password" placeholder="Enter your password" required>
                    </div>
                    
                    <div class="form-check">
                        <input type="checkbox" id="showPassword" class="form-check-input">
                        <label for="showPassword" class="form-check-label">Show Password</label>
                    </div>
                    
                    <button type="submit" class="login-btn">Login</button>
                </form>
            </div>
        </div>
    </div>

    <!-- Main System Container - Placeholder for redirection -->
    <div id="mainSystem" style="display: none;">
        <!-- This div is kept as a placeholder for the login/logout functionality -->
    </div>

    <!-- Scripts -->
    <script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
    <script src="<?= $baseUrl ?>/assets/js/shared/auth.js"></script>
</body>
</html>
